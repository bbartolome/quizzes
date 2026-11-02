import { inject, Injectable, Signal, signal } from '@angular/core';
import { APP_CLOCK } from '../app-clock';
import {
  AttemptInput,
  PRACTICE_KEY,
  PracticeSnapshot,
  PracticeState,
  REST_DAY_CAP,
  StreakState,
} from '../models/practice.models';
import { DateKey, dateKeyOf } from '../utils/dates';
import {
  applyPracticeDay,
  effectiveStreak,
  initialStreak,
  refillRestDays,
} from '../utils/practice-streak';

/** A practice day needs this many scored answers in one local calendar day (practice-layer.md §4.1). */
export const PRACTICE_DAY_THRESHOLD = 5;

const COVERED_LIMIT = 10;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Plain = Record<string, unknown>;

function storage(): Storage {
  return globalThis.localStorage;
}

function isRecord(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateKey(value: unknown): value is DateKey {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

function nonNegativeInt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function has(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function emptyStreak(): StreakState {
  return { current: 0, longest: 0, lastPracticeDate: null, restDays: 0, nextRestDayOn: null, covered: [] };
}

function emptyState(): PracticeState {
  return {
    version: 1,
    enabled: true,
    streak: emptyStreak(),
    today: { date: '', attempts: 0, dailyDone: false },
    lastPlayedAt: {},
    conceptDays: {},
    badges: {},
  };
}

function readStreak(value: unknown): StreakState {
  if (!isRecord(value)) return emptyStreak();
  const covered = Array.isArray(value['covered'])
    ? value['covered'].filter(isDateKey).slice(-COVERED_LIMIT)
    : [];
  return {
    current: nonNegativeInt(value['current']),
    longest: nonNegativeInt(value['longest']),
    lastPracticeDate: isDateKey(value['lastPracticeDate']) ? value['lastPracticeDate'] : null,
    restDays: Math.min(nonNegativeInt(value['restDays']), REST_DAY_CAP),
    nextRestDayOn: isDateKey(value['nextRestDayOn']) ? value['nextRestDayOn'] : null,
    covered,
  };
}

function readToday(value: unknown): PracticeState['today'] {
  const record = isRecord(value) ? value : {};
  return {
    date: isDateKey(record['date']) ? record['date'] : '',
    attempts: nonNegativeInt(record['attempts']),
    dailyDone: record['dailyDone'] === true,
  };
}

function readLastPlayed(value: unknown): PracticeState['lastPlayedAt'] {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function readConceptDays(value: unknown): PracticeState['conceptDays'] {
  if (!isRecord(value)) return {};
  const out: PracticeState['conceptDays'] = {};
  for (const [id, entry] of Object.entries(value)) {
    if (isRecord(entry) && isDateKey(entry['lastDay'])) {
      out[id] = { days: nonNegativeInt(entry['days'], 1), lastDay: entry['lastDay'] };
    }
  }
  return out;
}

function readBadges(value: unknown): PracticeState['badges'] {
  if (!isRecord(value)) return {};
  const out: PracticeState['badges'] = {};
  for (const [id, entry] of Object.entries(value)) {
    if (isRecord(entry) && typeof entry['earnedAt'] === 'string' && typeof entry['evidence'] === 'string') {
      out[id] = { earnedAt: entry['earnedAt'], evidence: entry['evidence'] };
    }
  }
  return out;
}

/** Field-by-field guard. An unknown or future version is treated as corrupt and zeroed. */
function sanitize(raw: unknown): PracticeState {
  if (!isRecord(raw) || raw['version'] !== 1) return emptyState();
  return {
    version: 1,
    enabled: typeof raw['enabled'] === 'boolean' ? raw['enabled'] : true,
    streak: readStreak(raw['streak']),
    today: readToday(raw['today']),
    lastPlayedAt: readLastPlayed(raw['lastPlayedAt']),
    conceptDays: readConceptDays(raw['conceptDays']),
    badges: readBadges(raw['badges']),
  };
}

/** Today's counters, reset when the local date has moved on. */
function todayFor(state: PracticeState, key: DateKey): PracticeState['today'] {
  return state.today.date === key ? state.today : { date: key, attempts: 0, dailyDone: false };
}

/** Records a practice day. applyPracticeDay is idempotent within a day, so this is safe to call repeatedly. */
function qualifyDay(streak: StreakState, key: DateKey): StreakState {
  return applyPracticeDay(streak.lastPracticeDate === null ? initialStreak(key) : streak, key);
}

function bumpConcepts(
  days: PracticeState['conceptDays'],
  conceptIds: readonly string[],
  key: DateKey,
): PracticeState['conceptDays'] {
  const next = { ...days };
  for (const id of new Set(conceptIds)) {
    const entry = has(next, id) ? next[id] : undefined;
    if (entry?.lastDay === key) continue;
    next[id] = { days: (entry?.days ?? 0) + 1, lastDay: key };
  }
  return next;
}

function toSnapshot(state: PracticeState, key: DateKey): PracticeSnapshot {
  const today = todayFor(state, key);
  return {
    enabled: state.enabled,
    streak: effectiveStreak(state.streak, key),
    longest: state.streak.longest,
    restDays: refillRestDays(state.streak, key).restDays,
    practicedToday: state.streak.lastPracticeDate === key,
    attemptsToday: today.attempts,
  };
}

/**
 * App-wide practice recorder. Reads never throw; writes are best-effort and surface
 * failures through `saveFailed`. Storage is read on every call, so it always reflects
 * the current `localStorage` (including resets from StatsService.resetAll).
 */
@Injectable({ providedIn: 'root' })
export class PracticeService {
  private readonly clock = inject(APP_CLOCK);
  private readonly failed = signal(false);
  readonly saveFailed: Signal<boolean> = this.failed.asReadonly();

  recordAttempt(quizId: string, input: AttemptInput, now?: Date): PracticeSnapshot {
    const at = now ?? this.clock();
    const key = dateKeyOf(at);
    const state = this.load();
    const today = todayFor(state, key);
    const attempts = today.attempts + nonNegativeInt(input.count, 1);

    const next: PracticeState = {
      ...state,
      streak: attempts >= PRACTICE_DAY_THRESHOLD ? qualifyDay(state.streak, key) : state.streak,
      today: { date: key, attempts, dailyDone: today.dailyDone },
      lastPlayedAt: { ...state.lastPlayedAt, [quizId]: at.toISOString() },
      conceptDays: bumpConcepts(state.conceptDays, input.conceptIds ?? [], key),
    };
    this.save(next);
    return toSnapshot(next, key);
  }

  recordDaily(now?: Date): PracticeSnapshot {
    const key = dateKeyOf(now ?? this.clock());
    const state = this.load();
    const today = todayFor(state, key);
    const next: PracticeState = {
      ...state,
      streak: qualifyDay(state.streak, key),
      today: { date: key, attempts: today.attempts, dailyDone: true },
    };
    this.save(next);
    return toSnapshot(next, key);
  }

  snapshot(now?: Date): PracticeSnapshot {
    return toSnapshot(this.load(), dateKeyOf(now ?? this.clock()));
  }

  setEnabled(enabled: boolean): void {
    this.save({ ...this.load(), enabled });
  }

  lastPlayed(): Readonly<Record<string, string>> {
    return this.load().lastPlayedAt;
  }

  conceptDays(): Readonly<Record<string, { days: number; lastDay: DateKey }>> {
    return this.load().conceptDays;
  }

  badges(): Readonly<Record<string, { earnedAt: string; evidence: string }>> {
    return this.load().badges;
  }

  /** Stores each newly earned badge once. An existing earnedAt is never overwritten, and badges are never revoked. */
  recordBadges(earned: { id: string; evidence: string }[], now?: Date): void {
    const state = this.load();
    const badges = { ...state.badges };
    const earnedAt = (now ?? this.clock()).toISOString();
    let changed = false;
    for (const { id, evidence } of earned) {
      if (has(badges, id)) continue;
      badges[id] = { earnedAt, evidence };
      changed = true;
    }
    if (changed) this.save({ ...state, badges });
  }

  private load(): PracticeState {
    try {
      const raw = storage().getItem(PRACTICE_KEY);
      return raw === null ? emptyState() : sanitize(JSON.parse(raw));
    } catch {
      return emptyState();
    }
  }

  private save(state: PracticeState): void {
    try {
      storage().setItem(PRACTICE_KEY, JSON.stringify(state));
      this.failed.set(false);
    } catch {
      this.failed.set(true);
    }
  }
}
