import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GtEvidenceService } from './gt-evidence.service';
import { GtLearnService } from './gt-learn.service';
import { StatsService } from '../../../core/services/stats.service';
import { PracticeService } from '../../../core/services/practice.service';
import { PRACTICE_KEY } from '../../../core/models/practice.models';
import { provideFixedClock } from '../../../../testing/fixed-clock';
import { MemoryStorage } from '../../../../testing/memory-storage';

const CARDS = 'stats:game-theory:cards';
const CHALLENGES = 'stats:game-theory:challenges';
const LEARN = 'stats:game-theory:learn';
const GAMES = 'stats:game-theory:games';
const BEST = 'best-response';
const NASH = 'nash-equilibrium';
const PARETO = 'pareto-efficiency';

/** Local noon, so the local calendar date is the same in every time zone the suite runs in. */
function local(y: number, m: number, d: number, h = 12): Date {
  return new Date(y, m - 1, d, h);
}

const NOW = local(2026, 11, 3);

describe('GtEvidenceService', () => {
  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);
    TestBed.configureTestingModule({ providers: [provideFixedClock(NOW.toISOString())] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function evidence(): GtEvidenceService {
    return TestBed.inject(GtEvidenceService);
  }

  function stats(): StatsService {
    return TestBed.inject(StatsService);
  }

  function practice(): PracticeService {
    return TestBed.inject(PracticeService);
  }

  function learn(): GtLearnService {
    return TestBed.inject(GtLearnService);
  }

  describe('record', () => {
    it('credits the concept under the challenges facet only', () => {
      evidence().record([BEST], true, 'challenges', NOW);

      expect(stats().getStats('game-theory:challenges').perTrait[BEST]).toEqual({
        traitId: BEST,
        correct: 1,
        attempted: 1,
      });
      expect(store.getItem(CARDS)).toBeNull();
    });

    it('credits the concept under the cards facet only', () => {
      evidence().record([BEST], false, 'cards', NOW);

      expect(stats().getStats('game-theory:cards').perTrait[BEST]).toEqual({
        traitId: BEST,
        correct: 0,
        attempted: 1,
      });
      expect(store.getItem(CHALLENGES)).toBeNull();
    });

    it('credits both concepts of a two-concept puzzle, and counts a repeated id once', () => {
      evidence().record([BEST, NASH, BEST], true, 'challenges', NOW);

      const perTrait = stats().getStats('game-theory:challenges').perTrait;
      expect(perTrait[BEST]).toEqual({ traitId: BEST, correct: 1, attempted: 1 });
      expect(perTrait[NASH]).toEqual({ traitId: NASH, correct: 1, attempted: 1 });
    });

    it('calls PracticeService.recordAttempt once for game-theory at the given instant', () => {
      const spy = vi.spyOn(practice(), 'recordAttempt');

      evidence().record([BEST, NASH], true, 'challenges', NOW);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('game-theory', { conceptIds: [BEST, NASH], count: 1 }, NOW);
    });

    it('counts a concept as mastered once it meets the mastery rule with challenge evidence', () => {
      // 3 challenge attempts and 6 card checks over two days: 9 attempts, all correct.
      const day1 = local(2026, 11, 2);
      const day2 = local(2026, 11, 3);
      for (let i = 0; i < 3; i += 1) evidence().record([NASH], true, 'challenges', day1);
      for (let i = 0; i < 5; i += 1) evidence().record([NASH], true, 'cards', day1);
      evidence().record([NASH], true, 'cards', day2);

      expect(learn().read().summary.mastered).toBe(1);
    });

    it('does not count a concept as mastered without three challenge attempts', () => {
      // The service has no concept modes, so it applies the stricter rule to every concept.
      const day1 = local(2026, 11, 2);
      const day2 = local(2026, 11, 3);
      for (let i = 0; i < 8; i += 1) evidence().record([NASH], true, 'cards', day1);
      evidence().record([NASH], true, 'cards', day2);

      expect(learn().read().summary.mastered).toBe(0);
    });

    it('repairs a corrupt per-concept entry before writing, so the count is not NaN', () => {
      store.setItem(
        CARDS,
        JSON.stringify({
          quizId: 'game-theory:cards',
          version: 0,
          perTrait: { [BEST]: 'junk' },
          streak: 0,
          roundsPlayed: 0,
        }),
      );

      evidence().record([BEST], true, 'cards', NOW);

      expect(stats().getStats('game-theory:cards').perTrait[BEST]).toEqual({
        traitId: BEST,
        correct: 1,
        attempted: 1,
      });
    });

    it('repairs negative counts before writing', () => {
      store.setItem(
        CHALLENGES,
        JSON.stringify({
          quizId: 'game-theory:challenges',
          version: 0,
          perTrait: { [BEST]: { traitId: BEST, correct: -4, attempted: 2 } },
          streak: 0,
          roundsPlayed: 0,
        }),
      );

      evidence().record([BEST], true, 'challenges', NOW);

      expect(stats().getStats('game-theory:challenges').perTrait[BEST]).toEqual({
        traitId: BEST,
        correct: 1,
        attempted: 1,
      });
    });

    it('treats a corrupt stats key as zeroed and still records', () => {
      store.setItem(CARDS, '{not json');

      expect(() => evidence().record([BEST], true, 'cards', NOW)).not.toThrow();

      expect(stats().getStats('game-theory:cards').perTrait[BEST]).toEqual({
        traitId: BEST,
        correct: 1,
        attempted: 1,
      });
    });
  });

  describe('recordSessionEnd', () => {
    it('bumps roundsPlayed once for a session that checked at least one card', () => {
      evidence().record([BEST], true, 'cards', NOW);
      evidence().record([NASH], false, 'cards', NOW);

      evidence().recordSessionEnd();

      expect(stats().getStats('game-theory:cards').roundsPlayed).toBe(1);
    });

    it('does not bump roundsPlayed for a session with no card checks', () => {
      evidence().recordSessionEnd();

      expect(stats().getStats('game-theory:cards').roundsPlayed).toBe(0);
    });

    it('does not count challenge attempts as a card session', () => {
      evidence().record([BEST], true, 'challenges', NOW);

      evidence().recordSessionEnd();

      expect(stats().getStats('game-theory:cards').roundsPlayed).toBe(0);
    });

    it('does not bump again on a second end with no new card checks', () => {
      evidence().record([BEST], true, 'cards', NOW);
      evidence().recordSessionEnd();

      evidence().recordSessionEnd();

      expect(stats().getStats('game-theory:cards').roundsPlayed).toBe(1);
    });
  });

  describe('recordDaily', () => {
    it('calls PracticeService.recordDaily with the given instant', () => {
      const spy = vi.spyOn(practice(), 'recordDaily');

      evidence().recordDaily(NOW);

      expect(spy).toHaveBeenCalledWith(NOW);
    });

    it('makes the day a practice day', () => {
      evidence().recordDaily(NOW);

      expect(practice().snapshot(NOW).practicedToday).toBe(true);
    });
  });

  describe('migrateContent', () => {
    it('prunes trait ids that are no longer in the content and stamps the version', () => {
      evidence().record([BEST, 'removed-concept'], true, 'cards', NOW);
      evidence().record([BEST, 'removed-concept'], true, 'challenges', NOW);

      evidence().migrateContent(2, [BEST, NASH]);

      for (const quizId of ['game-theory:cards', 'game-theory:challenges']) {
        const stored = stats().getStats(quizId);
        expect(Object.keys(stored.perTrait)).toEqual([BEST]);
        expect(stored.version).toBe(2);
      }
    });

    it('prunes learn concepts that are no longer in the content and sets the total', () => {
      learn().setStage('removed-concept', 2);
      learn().setStage(NASH, 2);

      evidence().migrateContent(1, [BEST, NASH]);

      expect(learn().read().concepts['removed-concept']).toBeUndefined();
      expect(learn().introduced.has('removed-concept')).toBe(false);
      expect(learn().read().summary.total).toBe(2);
    });

    it.each([5, -1])(
      'treats a stored version of %s as corrupt and zeroes that stats key',
      (storedVersion) => {
        store.setItem(
          CARDS,
          JSON.stringify({
            quizId: 'game-theory:cards',
            version: storedVersion,
            perTrait: { [BEST]: { traitId: BEST, correct: 3, attempted: 4 } },
            streak: 0,
            roundsPlayed: 0,
          }),
        );

        evidence().migrateContent(1, [BEST, NASH]);

        const stored = stats().getStats('game-theory:cards');
        expect(stored.perTrait).toEqual({});
        expect(stored.version).toBe(1);
      },
    );

    it('does not throw on a corrupt learn key', () => {
      store.setItem(LEARN, '{not json');

      expect(() => evidence().migrateContent(1, [BEST])).not.toThrow();
      expect(learn().read().summary.total).toBe(1);
    });
  });

  describe('write failures', () => {
    it('does not throw when a stats write fails, reports it, and recovers', () => {
      const spy = vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => evidence().record([BEST], true, 'cards', NOW)).not.toThrow();
      expect(evidence().saveFailed()).toBe(true);

      spy.mockRestore();
      evidence().record([BEST], true, 'cards', NOW);
      expect(evidence().saveFailed()).toBe(false);
    });

    it('reports a failed practice write through saveFailed without throwing', () => {
      const real = store.setItem.bind(store);
      vi.spyOn(store, 'setItem').mockImplementation((key, value) => {
        if (key === PRACTICE_KEY) {
          throw new Error('QuotaExceededError');
        }
        real(key, value);
      });

      expect(() => evidence().record([BEST], true, 'cards', NOW)).not.toThrow();
      expect(evidence().saveFailed()).toBe(true);
    });

    it('does not throw when the daily write fails', () => {
      vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => evidence().recordDaily(NOW)).not.toThrow();
    });
  });

  describe('reset', () => {
    it('StatsService.resetAll removes every stats:game-theory key', () => {
      evidence().record([BEST], true, 'cards', NOW);
      evidence().record([NASH], true, 'challenges', NOW);
      evidence().recordSessionEnd();
      learn().setStage(PARETO, 2);
      learn().recordDailyAnswer('2026-11-03', {
        kind: 'equilibrium',
        correct: true,
        reasonCorrect: true,
      });
      store.setItem(GAMES, JSON.stringify({ version: 1, counts: {}, records: [] }));
      expect(store.getItem(CARDS)).not.toBeNull();
      expect(store.getItem(CHALLENGES)).not.toBeNull();
      expect(store.getItem(LEARN)).not.toBeNull();

      stats().resetAll();

      const remaining = Array.from({ length: store.length }, (_, i) => store.key(i)).filter(
        (key): key is string => key !== null && key.startsWith('stats:game-theory:'),
      );
      expect(remaining).toEqual([]);
      expect(stats().getStats('game-theory:cards').perTrait).toEqual({});
      expect(stats().getStats('game-theory:challenges').perTrait).toEqual({});
      expect(learn().read().concepts).toEqual({});
      expect(learn().introduced.size).toBe(0);
    });
  });
});
