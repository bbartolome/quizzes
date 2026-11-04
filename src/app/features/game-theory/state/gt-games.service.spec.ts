import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GtGamesService } from './gt-games.service';
import type { GameKind, GamesLog, MatchRecord } from '../lib/state.types';
import { MemoryStorage } from '../../../../testing/memory-storage';

const KEY = 'stats:game-theory:games';
const MAX_RECORDS = 100;

const ZEROED: GamesLog = {
  version: 1,
  counts: {
    'repeated-pd': 0,
    'name-the-bot': 0,
    tournament: 0,
    'beauty-contest': 0,
    'first-price': 0,
    'second-price': 0,
    'common-value': 0,
  },
  records: [],
};

function match(i: number, kind: GameKind = 'repeated-pd'): MatchRecord {
  return {
    kind,
    at: '2026-11-03T12:00:00.000Z',
    seed: `seed-${i}`,
    summary: { bot: 'copycat', totalA: 3 + i, totalB: 2, mutualCooperation: 1 },
  };
}

describe('GtGamesService', () => {
  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function service(): GtGamesService {
    return TestBed.inject(GtGamesService);
  }

  function seed(value: unknown): void {
    store.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
  }

  describe('reads', () => {
    it('reads a log with all seven counts at zero and no records when nothing is stored', () => {
      expect(service().read()).toEqual(ZEROED);
    });

    it('keeps a well-formed stored log', () => {
      const log: GamesLog = {
        version: 1,
        counts: { ...ZEROED.counts, 'repeated-pd': 1 },
        records: [match(1)],
      };
      seed(log);

      expect(service().read()).toEqual(log);
    });

    it.each([
      ['unparseable JSON', '{not json'],
      ['null', 'null'],
      ['an array', '[]'],
      ['an unknown version', { version: 2, counts: {}, records: [] }],
    ])('reads zeroed when the stored value is %s', (_label, value) => {
      seed(value);

      expect(service().read()).toEqual(ZEROED);
    });

    it('guards each field: a negative count reads as zero and a bad record is dropped', () => {
      seed({
        version: 1,
        counts: { 'repeated-pd': -1, tournament: 2 },
        records: [{ kind: 'not-a-kind' }, match(1)],
      });

      const log = service().read();
      expect(log.counts['repeated-pd']).toBe(0);
      expect(log.counts.tournament).toBe(2);
      expect(log.records).toEqual([match(1)]);
    });

    it('reads zeroed when storage itself throws', () => {
      vi.spyOn(store, 'getItem').mockImplementation(() => {
        throw new Error('storage is blocked');
      });

      expect(service().read()).toEqual(ZEROED);
    });
  });

  describe('record', () => {
    it('appends the match, bumps its own kind, and stores the log under the games key', () => {
      expect(service().record(match(1))).toBe(true);

      const log = service().read();
      expect(log.counts['repeated-pd']).toBe(1);
      expect(log.records).toEqual([match(1)]);
      expect(JSON.parse(store.getItem(KEY) ?? 'null')).toEqual(log);
    });

    it('bumps only the count of the kind it records', () => {
      service().record(match(1, 'tournament'));

      const log = service().read();
      expect(log.counts.tournament).toBe(1);
      expect(log.counts['repeated-pd']).toBe(0);
    });

    it('keeps the most recent 100 match summaries but counts every match', () => {
      const games = service();
      for (let i = 1; i <= MAX_RECORDS + 1; i++) {
        games.record(match(i));
      }

      const log = games.read();
      expect(log.records).toHaveLength(MAX_RECORDS);
      expect(log.records[0].seed).toBe('seed-2');
      expect(log.records[MAX_RECORDS - 1].seed).toBe(`seed-${MAX_RECORDS + 1}`);
      expect(log.counts['repeated-pd']).toBe(MAX_RECORDS + 1);
    });

    it('returns false and sets saveFailed when the write throws, then clears it on the next good write', () => {
      const games = service();
      const setItem = vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(games.record(match(1))).toBe(false);
      expect(games.saveFailed()).toBe(true);

      setItem.mockRestore();
      expect(games.record(match(2))).toBe(true);
      expect(games.saveFailed()).toBe(false);
    });
  });
});
