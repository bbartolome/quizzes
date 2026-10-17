import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatsService } from './stats.service';
import { RoundQuestion, ScoredQuestionResult } from '../models/quiz.models';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function makeRoundQuestion(
  overrides: Partial<RoundQuestion> & { id: string },
): RoundQuestion {
  return {
    prompt: `Prompt for ${overrides.id}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswers: ['A'],
    traitIds: [],
    explanation: `Explanation for ${overrides.id}`,
    ...overrides,
  };
}

function makeResult(
  traitId: string,
  correct: boolean,
  overrides: Partial<ScoredQuestionResult> = {},
): ScoredQuestionResult {
  return {
    question: makeRoundQuestion({
      id: `q-${traitId}`,
      sourceTemplateId: traitId,
      traitIds: [traitId],
    }),
    selected: correct ? ['A'] : [],
    correct,
    missed: correct ? [] : ['A'],
    extra: [],
    ...overrides,
  };
}

describe('StatsService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    globalThis.localStorage.clear();
    vi.unstubAllGlobals();
  });

  describe('storage namespacing', () => {
    it('namespaces the storage key as stats:<quizId>', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));

      expect(globalThis.localStorage.getItem('stats:reasoning-traps')).not.toBeNull();
    });

    it('keeps two different quizIds from reading or writing each other data', () => {
      const service = new StatsService();

      service.recordResult('quiz-a', makeResult('strawman', true));
      service.recordResult('quiz-b', makeResult('anchoring', false));

      const statsA = service.getStats('quiz-a');
      const statsB = service.getStats('quiz-b');

      expect(statsA.perTrait['strawman']).toBeDefined();
      expect(statsA.perTrait['anchoring']).toBeUndefined();
      expect(statsB.perTrait['anchoring']).toBeDefined();
      expect(statsB.perTrait['strawman']).toBeUndefined();
    });
  });

  describe('recordResult', () => {
    it('increments perTrait attempted and correct on a correct answer', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait['strawman']).toEqual({
        traitId: 'strawman',
        correct: 1,
        attempted: 1,
      });
    });

    it('increments perTrait attempted but not correct on an incorrect answer', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', false));

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait['strawman']).toEqual({
        traitId: 'strawman',
        correct: 0,
        attempted: 1,
      });
    });

    it('accumulates attempted and correct across repeated results for the same trait', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', false));

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait['strawman']).toEqual({
        traitId: 'strawman',
        correct: 2,
        attempted: 3,
      });
    });

    it('increments perTrait for each distinct id in traitIds', () => {
      const service = new StatsService();

      service.recordResult(
        'reasoning-traps',
        makeResult('strawman', true, {
          question: makeRoundQuestion({
            id: 'q-multi',
            traitIds: ['strawman', 'anchoring'],
          }),
        }),
      );

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait['strawman']).toEqual({
        traitId: 'strawman',
        correct: 1,
        attempted: 1,
      });
      expect(stats.perTrait['anchoring']).toEqual({
        traitId: 'anchoring',
        correct: 1,
        attempted: 1,
      });
    });

    it('counts a duplicated trait id in traitIds only once', () => {
      const service = new StatsService();

      service.recordResult(
        'reasoning-traps',
        makeResult('strawman', false, {
          question: makeRoundQuestion({
            id: 'q-dup',
            traitIds: ['strawman', 'strawman'],
          }),
        }),
      );

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait['strawman']).toEqual({
        traitId: 'strawman',
        correct: 0,
        attempted: 1,
      });
    });

    it('leaves perTrait unchanged when traitIds is empty', () => {
      const service = new StatsService();

      service.recordResult(
        'reasoning-traps',
        makeResult('strawman', true, {
          question: makeRoundQuestion({ id: 'q-empty', traitIds: [] }),
        }),
      );

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait).toEqual({});
    });

    it('updates the streak exactly once per call even with multiple traitIds', () => {
      const service = new StatsService();

      service.recordResult(
        'reasoning-traps',
        makeResult('strawman', true, {
          question: makeRoundQuestion({
            id: 'q-multi',
            traitIds: ['strawman', 'anchoring'],
          }),
        }),
      );
      service.recordResult(
        'reasoning-traps',
        makeResult('strawman', true, {
          question: makeRoundQuestion({
            id: 'q-multi-2',
            traitIds: ['strawman', 'anchoring'],
          }),
        }),
      );

      const stats = service.getStats('reasoning-traps');
      expect(stats.streak).toBe(2);
    });

    it('increments the streak on consecutive correct answers', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', true));

      const stats = service.getStats('reasoning-traps');
      expect(stats.streak).toBe(3);
    });

    it('resets the streak to zero on an incorrect answer', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', false));

      const stats = service.getStats('reasoning-traps');
      expect(stats.streak).toBe(0);
    });
  });

  describe('recordSessionEnd', () => {
    it('increments roundsPlayed by 1', () => {
      const service = new StatsService();

      service.recordSessionEnd('reasoning-traps');

      const stats = service.getStats('reasoning-traps');
      expect(stats.roundsPlayed).toBe(1);
    });

    it('increments roundsPlayed by 1 on each call', () => {
      const service = new StatsService();

      service.recordSessionEnd('reasoning-traps');
      service.recordSessionEnd('reasoning-traps');
      service.recordSessionEnd('reasoning-traps');

      const stats = service.getStats('reasoning-traps');
      expect(stats.roundsPlayed).toBe(3);
    });

    it('persists roundsPlayed so it is visible via getStats on a fresh read', () => {
      const service = new StatsService();

      service.recordSessionEnd('reasoning-traps');

      expect(globalThis.localStorage.getItem('stats:reasoning-traps')).not.toBeNull();
      expect(new StatsService().getStats('reasoning-traps').roundsPlayed).toBe(1);
    });

    it('returns the updated stats', () => {
      const service = new StatsService();

      const stats = service.recordSessionEnd('reasoning-traps');

      expect(stats.roundsPlayed).toBe(1);
    });
  });

  describe('getStats', () => {
    it('returns a zeroed-out QuizStats for a quiz with no recorded history', () => {
      const service = new StatsService();

      const stats = service.getStats('never-played');

      expect(stats.quizId).toBe('never-played');
      expect(stats.perTrait).toEqual({});
      expect(stats.streak).toBe(0);
      expect(stats.roundsPlayed).toBe(0);
    });
  });

  describe('getWeakTraits', () => {
    it('returns traits ordered from lowest to highest accuracy', () => {
      const service = new StatsService();

      // strongest: 3/3
      service.recordResult('reasoning-traps', makeResult('anchoring', true));
      service.recordResult('reasoning-traps', makeResult('anchoring', true));
      service.recordResult('reasoning-traps', makeResult('anchoring', true));

      // middle: 1/2
      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', false));

      // weakest: 0/2
      service.recordResult('reasoning-traps', makeResult('sunk-cost', false));
      service.recordResult('reasoning-traps', makeResult('sunk-cost', false));

      const weakTraits = service.getWeakTraits('reasoning-traps');

      expect(weakTraits[0]).toBe('sunk-cost');
      expect(weakTraits[1]).toBe('strawman');
      expect(weakTraits[2]).toBe('anchoring');
    });

    it('respects the limit parameter', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('anchoring', true));
      service.recordResult('reasoning-traps', makeResult('strawman', false));
      service.recordResult('reasoning-traps', makeResult('sunk-cost', false));

      const weakTraits = service.getWeakTraits('reasoning-traps', 2);

      expect(weakTraits).toHaveLength(2);
    });
  });

  describe('migrateVersion', () => {
    it('drops perTrait entries whose traitId is not in validTraitIds without throwing', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('retired-trait', true));

      expect(() =>
        service.migrateVersion('reasoning-traps', 2, ['strawman']),
      ).not.toThrow();

      const stats = service.getStats('reasoning-traps');
      expect(stats.perTrait['strawman']).toBeDefined();
      expect(stats.perTrait['retired-trait']).toBeUndefined();
    });

    it('keeps existing stats such as streak and roundsPlayed, and updates the version', () => {
      const service = new StatsService();

      service.recordResult('reasoning-traps', makeResult('strawman', true));
      service.recordResult('reasoning-traps', makeResult('strawman', true));

      const before = service.getStats('reasoning-traps');

      service.migrateVersion('reasoning-traps', 7, ['strawman']);

      const after = service.getStats('reasoning-traps');
      expect(after.version).toBe(7);
      expect(after.streak).toBe(before.streak);
      expect(after.roundsPlayed).toBe(before.roundsPlayed);
    });

    it('does not throw when migrating a quiz with no recorded history', () => {
      const service = new StatsService();

      expect(() =>
        service.migrateVersion('never-played', 3, ['strawman']),
      ).not.toThrow();

      expect(service.getStats('never-played').version).toBe(3);
    });
  });

  describe('resetQuiz', () => {
    it('clears only the given quiz key, leaving other quizzes intact', () => {
      const service = new StatsService();

      service.recordResult('quiz-a', makeResult('strawman', true));
      service.recordResult('quiz-b', makeResult('anchoring', true));

      service.resetQuiz('quiz-a');

      expect(globalThis.localStorage.getItem('stats:quiz-a')).toBeNull();
      expect(globalThis.localStorage.getItem('stats:quiz-b')).not.toBeNull();
      expect(service.getStats('quiz-a').perTrait).toEqual({});
      expect(service.getStats('quiz-b').perTrait['anchoring']).toBeDefined();
    });
  });

  describe('resetAll', () => {
    it('clears every stats:* key without touching unrelated keys', () => {
      const service = new StatsService();

      service.recordResult('quiz-a', makeResult('strawman', true));
      service.recordResult('quiz-b', makeResult('anchoring', true));
      globalThis.localStorage.setItem('unrelated-key', 'keep-me');

      service.resetAll();

      expect(globalThis.localStorage.getItem('stats:quiz-a')).toBeNull();
      expect(globalThis.localStorage.getItem('stats:quiz-b')).toBeNull();
      expect(globalThis.localStorage.getItem('unrelated-key')).toBe('keep-me');
    });
  });
});
