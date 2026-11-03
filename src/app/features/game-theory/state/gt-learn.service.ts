import { inject, Injectable, Signal, signal } from '@angular/core';
import type { ConceptLearn, LearnState, TutorialStage } from '../lib/state.types';
import type { PuzzleKind } from '../lib/puzzle.types';
import { DateKey } from '../../../core/utils/dates';
import { daysFor, masteryOf } from '../../../core/utils/mastery';
import { PracticeService } from '../../../core/services/practice.service';
import { StatsService } from '../../../core/services/stats.service';

const LEARN_KEY = 'stats:game-theory:learn';
const DAILY_LIMIT = 60;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PUZZLE_KINDS: readonly PuzzleKind[] = ['equilibrium', 'classify', 'eliminate'];

/** StatsService quiz ids for the two evidence keys: `stats:game-theory:cards` and `:challenges`. */
export const EVIDENCE_QUIZ_IDS = {
  cards: 'game-theory:cards',
  challenges: 'game-theory:challenges',
} as const;

type Plain = Record<string, unknown>;
type DailyEntry = LearnState['daily'][string];

function storage(): Storage {
  return globalThis.localStorage;
}

function isRecord(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStage(value: unknown): value is TutorialStage {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isKind(value: unknown): value is PuzzleKind {
  return typeof value === 'string' && (PUZZLE_KINDS as readonly string[]).includes(value);
}

/**
 * A per-concept evidence row, or null if it is malformed. Counts must be non-negative integers,
 * and correct cannot exceed attempted. Shared by the learn summary and the evidence writes.
 */
export function countOf(entry: unknown): { attempted: number; correct: number } | null {
  if (!isRecord(entry)) {
    return null;
  }
  const attempted = entry['attempted'];
  const correct = entry['correct'];
  if (!isCount(attempted) || !isCount(correct) || correct > attempted) {
    return null;
  }
  return { attempted, correct };
}

function zeroed(): LearnState {
  return { version: 1, concepts: {}, summary: { mastered: 0, introduced: 0, total: 0 }, daily: {} };
}

/** Keeps the last DAILY_LIMIT dates. Keys are YYYY-MM-DD, so string order is date order. */
function keepLastDays(daily: LearnState['daily']): LearnState['daily'] {
  return Object.fromEntries(
    Object.keys(daily)
      .sort()
      .slice(-DAILY_LIMIT)
      .map((date): [string, DailyEntry] => [date, daily[date]]),
  );
}

function readConcepts(value: unknown): LearnState['concepts'] {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([id, entry]): [string, ConceptLearn][] => {
      if (!isRecord(entry)) {
        return [];
      }
      const stage = entry['stage'];
      return [[id, { stage: isStage(stage) ? stage : 0, testedOut: entry['testedOut'] === true }]];
    }),
  );
}

function readSummary(value: unknown): LearnState['summary'] {
  const record = isRecord(value) ? value : {};
  return {
    mastered: isCount(record['mastered']) ? record['mastered'] : 0,
    introduced: isCount(record['introduced']) ? record['introduced'] : 0,
    total: isCount(record['total']) ? record['total'] : 0,
  };
}

function readDaily(value: unknown): LearnState['daily'] {
  if (!isRecord(value)) {
    return {};
  }
  return keepLastDays(
    Object.fromEntries(
      Object.entries(value).flatMap(([date, entry]): [string, DailyEntry][] => {
        if (!DATE_KEY_PATTERN.test(date) || !isRecord(entry)) {
          return [];
        }
        const kind = entry['kind'];
        if (!isKind(kind)) {
          return [];
        }
        return [
          [
            date,
            {
              kind,
              correct: entry['correct'] === true,
              reasonCorrect: entry['reasonCorrect'] === true,
            },
          ],
        ];
      }),
    ),
  );
}

/** Field-by-field guard. An unknown or future version reads as zeroed. */
function sanitize(raw: unknown): LearnState {
  if (!isRecord(raw) || raw['version'] !== 1) {
    return zeroed();
  }
  return {
    version: 1,
    concepts: readConcepts(raw['concepts']),
    summary: readSummary(raw['summary']),
    daily: readDaily(raw['daily']),
  };
}

/** Introduced (§7.2): tutorial stage at least 2 (Try), or tested out. */
function introducedIn(state: LearnState): Set<string> {
  return new Set(
    Object.keys(state.concepts).filter((id) => {
      const concept = state.concepts[id];
      return concept.stage >= 2 || concept.testedOut;
    }),
  );
}

/**
 * Owns `stats:game-theory:learn`, the `LearnState` shape in lib/state.types.ts (§10).
 * Reads never throw. Writes are best-effort: a failed write returns false and sets `saveFailed`,
 * so the page can show "Progress can't be saved in this browser".
 */
@Injectable({ providedIn: 'root' })
export class GtLearnService {
  private readonly stats = inject(StatsService);
  private readonly practice = inject(PracticeService);
  private readonly failed = signal(false);
  readonly saveFailed: Signal<boolean> = this.failed.asReadonly();
  /** The last requiresChallenge map given to refresh. Empty until one is, so every concept requires a challenge. */
  private requiresChallengeMap: Record<string, boolean> = {};

  /** The sanitised learn state. Never throws. */
  read(): LearnState {
    try {
      const raw = storage().getItem(LEARN_KEY);
      return raw === null ? zeroed() : sanitize(JSON.parse(raw));
    } catch {
      return zeroed();
    }
  }

  /** Concept ids counted as introduced (§7.2). Pages gate card and puzzle pools on this. */
  get introduced(): ReadonlySet<string> {
    return introducedIn(this.read());
  }

  /** Moves a concept's stage forward. A stage never goes down. */
  setStage(conceptId: string, stage: TutorialStage): boolean {
    if (!isStage(stage)) {
      return false;
    }
    const state = this.read();
    const current: ConceptLearn | undefined = state.concepts[conceptId];
    const from = current?.stage ?? 0;
    state.concepts = {
      ...state.concepts,
      [conceptId]: { stage: stage > from ? stage : from, testedOut: current?.testedOut ?? false },
    };
    return this.commit(state);
  }

  /** Marks a concept tested out, which also sets stage 3 (§7.1). */
  testOut(conceptId: string): boolean {
    const state = this.read();
    state.concepts = { ...state.concepts, [conceptId]: { stage: 3, testedOut: true } };
    return this.commit(state);
  }

  /** Stores a daily answer under its date and keeps the last 60 dates (§9.2, §10). */
  recordDailyAnswer(dateKey: DateKey, entry: DailyEntry): boolean {
    if (!DATE_KEY_PATTERN.test(dateKey)) {
      return false;
    }
    const state = this.read();
    state.daily = keepLastDays({
      ...state.daily,
      [dateKey]: { kind: entry.kind, correct: entry.correct, reasonCorrect: entry.reasonCorrect },
    });
    return this.commit(state);
  }

  /**
   * Recomputes the summary from stats and practice. With a concept list, it also prunes entries
   * for ids that are no longer in the content, and sets `total` to the number of distinct ids.
   * With a requiresChallenge map (§7.3: false for a concept whose modes are only 'cards'), it
   * replaces the map that Mastered uses. The map is kept for later writes, so a card check's own
   * refresh does not undo it. Without a map, the last one given still applies.
   */
  refresh(conceptIds?: readonly string[], requiresChallenge?: Record<string, boolean>): boolean {
    if (requiresChallenge) {
      this.requiresChallengeMap = { ...requiresChallenge };
    }
    const state = this.read();
    if (conceptIds) {
      const valid = new Set(conceptIds);
      state.concepts = Object.fromEntries(
        Object.entries(state.concepts).filter(([id]) => valid.has(id)),
      );
      state.summary = { ...state.summary, total: valid.size };
    }
    return this.commit(state);
  }

  /** Persists the state with a fresh summary. Returns false, and sets saveFailed, if the write throws. */
  private commit(state: LearnState): boolean {
    try {
      const next: LearnState = {
        ...state,
        summary: {
          mastered: this.masteredCount(),
          introduced: introducedIn(state).size,
          total: state.summary.total,
        },
      };
      storage().setItem(LEARN_KEY, JSON.stringify(next));
      this.failed.set(false);
      return true;
    } catch {
      this.failed.set(true);
      return false;
    }
  }

  /** Whether a concept needs challenge evidence to reach Mastered. An id missing from the map does. */
  private requiresChallengeFor(conceptId: string): boolean {
    return Object.hasOwn(this.requiresChallengeMap, conceptId)
      ? this.requiresChallengeMap[conceptId]
      : true;
  }

  /**
   * Concepts at Mastered (§7.3), from the pooled cards and challenges counts. Without a map every
   * concept requires a challenge, which can only under-count a cards-only concept. It never
   * over-claims a concept that needs challenge evidence.
   */
  private masteredCount(): number {
    const cards = this.stats.getStats(EVIDENCE_QUIZ_IDS.cards).perTrait;
    const challenges = this.stats.getStats(EVIDENCE_QUIZ_IDS.challenges).perTrait;
    const conceptDays = this.practice.conceptDays();
    const ids = new Set([...Object.keys(cards), ...Object.keys(challenges)]);
    let mastered = 0;
    for (const id of ids) {
      const card = countOf(cards[id]);
      const challenge = countOf(challenges[id]);
      const attempted = (card?.attempted ?? 0) + (challenge?.attempted ?? 0);
      const state = masteryOf({
        attempted,
        correct: (card?.correct ?? 0) + (challenge?.correct ?? 0),
        days: daysFor(conceptDays[id], attempted),
        challengeAttempts: challenge?.attempted ?? 0,
        requiresChallenge: this.requiresChallengeFor(id),
      });
      if (state === 'mastered') {
        mastered += 1;
      }
    }
    return mastered;
  }
}
