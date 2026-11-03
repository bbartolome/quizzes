import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GtLearnService } from './gt-learn.service';
import type { LearnState, TutorialStage } from '../lib/state.types';
import { addDays } from '../../../core/utils/dates';
import { provideFixedClock } from '../../../../testing/fixed-clock';
import { MemoryStorage } from '../../../../testing/memory-storage';

const KEY = 'stats:game-theory:learn';
const BEST = 'best-response';
const NASH = 'nash-equilibrium';
const PARETO = 'pareto-efficiency';
const TODAY = '2026-11-03';

const ZEROED: LearnState = {
  version: 1,
  concepts: {},
  summary: { mastered: 0, introduced: 0, total: 0 },
  daily: {},
};

const DAILY = { kind: 'equilibrium', correct: true, reasonCorrect: true } as const;

describe('GtLearnService', () => {
  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);
    TestBed.configureTestingModule({
      providers: [provideFixedClock(new Date(2026, 10, 3, 12).toISOString())],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function seed(value: unknown): void {
    store.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
  }

  function service(): GtLearnService {
    return TestBed.inject(GtLearnService);
  }

  describe('reads', () => {
    it('reads zeroed state when nothing is stored', () => {
      expect(service().read()).toEqual(ZEROED);
    });

    it('keeps a well-formed stored state', () => {
      const state: LearnState = {
        version: 1,
        concepts: { [BEST]: { stage: 2, testedOut: false } },
        summary: { mastered: 0, introduced: 1, total: 2 },
        daily: { [TODAY]: { kind: 'classify', correct: false, reasonCorrect: true } },
      };
      seed(state);

      expect(service().read()).toEqual(state);
    });

    it.each([
      ['unparseable JSON', '{not json'],
      ['null', 'null'],
      ['an array', '[]'],
      ['a number', '42'],
      ['a string', '"learn"'],
      [
        'a missing version',
        JSON.stringify({ concepts: { [BEST]: { stage: 3, testedOut: true } } }),
      ],
      [
        'a string version',
        JSON.stringify({ version: '1', concepts: { [BEST]: { stage: 3, testedOut: true } } }),
      ],
      [
        'a future version',
        JSON.stringify({
          version: 2,
          concepts: { [BEST]: { stage: 3, testedOut: true } },
          summary: { mastered: 1, introduced: 1, total: 1 },
          daily: {},
        }),
      ],
    ])('reads zeroed state for %s, without throwing', (_label, raw) => {
      seed(raw);

      expect(service().read()).toEqual(ZEROED);
      expect(service().introduced.size).toBe(0);
    });

    it('reads zeroed state when storage itself throws', () => {
      vi.spyOn(store, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(service().read()).toEqual(ZEROED);
    });

    it('defaults each concept field that has the wrong type, and drops non-object entries', () => {
      seed({
        version: 1,
        concepts: {
          [BEST]: { stage: 'two', testedOut: 'yes' },
          [NASH]: 'junk',
          [PARETO]: { stage: 9, testedOut: false },
        },
        summary: {},
        daily: {},
      });

      expect(service().read().concepts).toEqual({
        [BEST]: { stage: 0, testedOut: false },
        [PARETO]: { stage: 0, testedOut: false },
      });
    });

    it('treats a non-integer stage as zero', () => {
      seed({
        version: 1,
        concepts: { [BEST]: { stage: 2.5, testedOut: false } },
        summary: {},
        daily: {},
      });

      expect(service().read().concepts[BEST]).toEqual({ stage: 0, testedOut: false });
    });

    it('defaults missing, negative, non-integer or non-numeric summary counts to zero', () => {
      seed({
        version: 1,
        concepts: {},
        summary: { mastered: -2, introduced: 1.5, total: '7' },
        daily: {},
      });

      expect(service().read().summary).toEqual({ mastered: 0, introduced: 0, total: 0 });
    });

    it('drops daily entries with a bad date, a bad kind, or a non-object value', () => {
      seed({
        version: 1,
        concepts: {},
        summary: {},
        daily: {
          [TODAY]: { kind: 'equilibrium', correct: true, reasonCorrect: true },
          yesterday: { kind: 'equilibrium', correct: true, reasonCorrect: true },
          '2026-11-02': { kind: 'bogus', correct: true, reasonCorrect: true },
          '2026-11-01': 'junk',
          '2026-10-31': { kind: 'classify', correct: 'yes', reasonCorrect: 1 },
        },
      });

      expect(service().read().daily).toEqual({
        [TODAY]: { kind: 'equilibrium', correct: true, reasonCorrect: true },
        '2026-10-31': { kind: 'classify', correct: false, reasonCorrect: false },
      });
    });

    it('keeps only the last 60 daily dates on read', () => {
      const daily: Record<string, typeof DAILY> = {};
      for (let i = 0; i < 62; i += 1) {
        daily[addDays('2026-01-01', i)] = DAILY;
      }
      seed({ version: 1, concepts: {}, summary: {}, daily });

      const kept = Object.keys(service().read().daily);
      expect(kept).toHaveLength(60);
      expect(kept).not.toContain('2026-01-01');
      expect(kept).not.toContain('2026-01-02');
      expect(kept).toContain(addDays('2026-01-01', 61));
    });
  });

  describe('introduced', () => {
    it.each([
      [0, false, false],
      [1, false, false],
      [2, false, true],
      [3, false, true],
      [0, true, true],
    ] as const)('stage %i with testedOut %s is introduced: %s', (stage, testedOut, introduced) => {
      seed({ version: 1, concepts: { [BEST]: { stage, testedOut } }, summary: {}, daily: {} });

      expect(service().introduced.has(BEST)).toBe(introduced);
    });
  });

  describe('writes', () => {
    it('moves a concept to Try, which introduces it', () => {
      const learn = service();

      expect(learn.setStage(BEST, 2)).toBe(true);

      expect(learn.introduced.has(BEST)).toBe(true);
      expect(learn.read().concepts[BEST]).toEqual({ stage: 2, testedOut: false });
    });

    it('never lowers a concept stage', () => {
      const learn = service();
      learn.setStage(BEST, 2);

      learn.setStage(BEST, 1);

      expect(learn.read().concepts[BEST].stage).toBe(2);
    });

    it('rejects a stage outside 0 to 3 without writing', () => {
      const learn = service();

      expect(learn.setStage(BEST, 4 as TutorialStage)).toBe(false);
      expect(store.getItem(KEY)).toBeNull();
    });

    it('marks a concept tested out at stage 3, which introduces it', () => {
      const learn = service();

      expect(learn.testOut(NASH)).toBe(true);

      expect(learn.read().concepts[NASH]).toEqual({ stage: 3, testedOut: true });
      expect(learn.introduced.has(NASH)).toBe(true);
    });

    it('stores a daily answer under its date', () => {
      const learn = service();

      learn.recordDailyAnswer(TODAY, { kind: 'classify', correct: true, reasonCorrect: false });

      expect(learn.read().daily).toEqual({
        [TODAY]: { kind: 'classify', correct: true, reasonCorrect: false },
      });
    });

    it('replaces the answer for a date that already has one', () => {
      const learn = service();
      learn.recordDailyAnswer(TODAY, { kind: 'classify', correct: false, reasonCorrect: false });

      learn.recordDailyAnswer(TODAY, { kind: 'eliminate', correct: true, reasonCorrect: true });

      expect(Object.keys(learn.read().daily)).toEqual([TODAY]);
      expect(learn.read().daily[TODAY].kind).toBe('eliminate');
    });

    it('keeps the last 60 dates and drops the oldest', () => {
      const learn = service();
      for (let i = 0; i < 61; i += 1) {
        learn.recordDailyAnswer(addDays('2026-01-01', i), DAILY);
      }

      const kept = Object.keys(learn.read().daily);
      expect(kept).toHaveLength(60);
      expect(kept).not.toContain('2026-01-01');
      expect(kept).toContain(addDays('2026-01-01', 60));
    });

    it('drops a new date that is older than the last 60 kept dates', () => {
      const learn = service();
      for (let i = 0; i < 60; i += 1) {
        learn.recordDailyAnswer(addDays('2026-01-02', i), DAILY);
      }

      learn.recordDailyAnswer('2026-01-01', DAILY);

      const kept = Object.keys(learn.read().daily);
      expect(kept).toHaveLength(60);
      expect(kept).not.toContain('2026-01-01');
    });
  });

  describe('summary', () => {
    it('sets total to the number of distinct concept ids on refresh', () => {
      const learn = service();

      learn.refresh([BEST, NASH, BEST]);

      expect(learn.read().summary.total).toBe(2);
    });

    it('prunes learn entries for concept ids that are no longer in the content', () => {
      const learn = service();
      learn.setStage(BEST, 2);
      learn.setStage(NASH, 2);

      learn.refresh([NASH]);

      expect(Object.keys(learn.read().concepts)).toEqual([NASH]);
      expect(learn.introduced.has(BEST)).toBe(false);
    });

    it('counts introduced concepts in the summary as stages and tests-out change', () => {
      const learn = service();
      learn.refresh([BEST, NASH, PARETO]);

      learn.setStage(BEST, 2);
      learn.testOut(NASH);
      learn.setStage(PARETO, 1);

      expect(learn.read().summary).toEqual({ mastered: 0, introduced: 2, total: 3 });
    });

    it('does not count a concept still at Explore', () => {
      const learn = service();
      learn.refresh([BEST]);

      learn.setStage(BEST, 1);

      expect(learn.read().summary.introduced).toBe(0);
    });
  });

  describe('write failures', () => {
    it('returns false, reports it through saveFailed, and recovers on the next good write', () => {
      const learn = service();
      const spy = vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => learn.setStage(BEST, 2)).not.toThrow();
      expect(learn.setStage(BEST, 2)).toBe(false);
      expect(learn.saveFailed()).toBe(true);

      spy.mockRestore();
      expect(learn.setStage(BEST, 2)).toBe(true);
      expect(learn.saveFailed()).toBe(false);
    });
  });
});
