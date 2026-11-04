import { Injectable, Signal, signal } from '@angular/core';
import type { GameKind, GamesLog, MatchRecord } from '../lib/state.types';

const GAMES_KEY = 'stats:game-theory:games';
const RECORD_LIMIT = 100;

type Plain = Record<string, unknown>;

function storage(): Storage {
  return globalThis.localStorage;
}

function isRecord(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isGameKind(value: unknown): value is GameKind {
  return typeof value === 'string' && (Object.keys(emptyCounts()) as string[]).includes(value);
}

function emptyCounts(): Record<GameKind, number> {
  return {
    'repeated-pd': 0,
    'name-the-bot': 0,
    tournament: 0,
    'beauty-contest': 0,
    'first-price': 0,
    'second-price': 0,
    'common-value': 0,
  };
}

function zeroed(): GamesLog {
  return { version: 1, counts: emptyCounts(), records: [] };
}

/** A summary is valid if it is a record of strings, numbers and booleans. */
function isSummary(value: unknown): value is MatchRecord['summary'] {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (field) =>
        typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean',
    )
  );
}

/** A match record, or null if any field is malformed. */
function recordOf(value: unknown): MatchRecord | null {
  if (!isRecord(value) || !isGameKind(value['kind'])) {
    return null;
  }
  const at = value['at'];
  const seed = value['seed'];
  if (typeof at !== 'string' || typeof seed !== 'string' || !isSummary(value['summary'])) {
    return null;
  }
  return { kind: value['kind'], at, seed, summary: value['summary'] };
}

function readCounts(value: unknown): Record<GameKind, number> {
  const raw = isRecord(value) ? value : {};
  const counts = emptyCounts();
  for (const kind of Object.keys(counts) as GameKind[]) {
    const count = raw[kind];
    counts[kind] = isCount(count) ? count : 0;
  }
  return counts;
}

/** Field-by-field guard. An unknown or future version reads as zeroed. */
function sanitize(raw: unknown): GamesLog {
  if (!isRecord(raw) || raw['version'] !== 1) {
    return zeroed();
  }
  const records = Array.isArray(raw['records']) ? raw['records'] : [];
  return {
    version: 1,
    counts: readCounts(raw['counts']),
    records: records
      .map(recordOf)
      .filter((entry): entry is MatchRecord => entry !== null)
      .slice(-RECORD_LIMIT),
  };
}

/**
 * Owns `stats:game-theory:games`, the `GamesLog` shape in lib/state.types.ts (§10).
 * Reads never throw. Writes are best-effort: a failed write returns false and sets `saveFailed`,
 * so the page can show "Progress can't be saved in this browser".
 */
@Injectable({ providedIn: 'root' })
export class GtGamesService {
  private readonly failed = signal(false);
  readonly saveFailed: Signal<boolean> = this.failed.asReadonly();

  /** The sanitised games log. Never throws. */
  read(): GamesLog {
    try {
      const raw = storage().getItem(GAMES_KEY);
      return raw === null ? zeroed() : sanitize(JSON.parse(raw));
    } catch {
      return zeroed();
    }
  }

  /** Appends a completed match, bumps its kind's count, and keeps the last 100 summaries (§10). */
  record(entry: MatchRecord): boolean {
    const log = this.read();
    return this.commit({
      version: 1,
      counts: { ...log.counts, [entry.kind]: log.counts[entry.kind] + 1 },
      records: [...log.records, entry].slice(-RECORD_LIMIT),
    });
  }

  private commit(log: GamesLog): boolean {
    try {
      storage().setItem(GAMES_KEY, JSON.stringify(log));
      this.failed.set(false);
      return true;
    } catch {
      this.failed.set(true);
      return false;
    }
  }
}
