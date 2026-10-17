import { describe, it, expect } from 'vitest';
import { QuizEngineService } from './quiz-engine.service';
import { Question, RoundQuestion } from '../models/quiz.models';

function makeQuestion(overrides: Partial<Question> & { id: string }): Question {
  return {
    prompt: `Prompt for ${overrides.id}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswers: ['A'],
    category: 'fallacy',
    tags: [],
    explanation: `Explanation for ${overrides.id}`,
    difficulty: 1,
    ...overrides,
  };
}

function makeRoundQuestion(overrides: Partial<RoundQuestion> & { id: string }): RoundQuestion {
  return {
    prompt: `Prompt for ${overrides.id}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswers: ['A'],
    traitIds: [],
    explanation: `Explanation for ${overrides.id}`,
    ...overrides,
  };
}

describe('QuizEngineService', () => {
  describe('selectRound', () => {
    it('narrows the pool by category', () => {
      const service = new QuizEngineService();
      const bank = {
        questions: [
          makeQuestion({ id: 'fallacy-1', category: 'fallacy', tags: ['strawman'] }),
          makeQuestion({ id: 'fallacy-2', category: 'fallacy', tags: ['strawman'] }),
          makeQuestion({ id: 'bias-1', category: 'bias', tags: ['anchoring'] }),
          makeQuestion({ id: 'bias-2', category: 'bias', tags: ['anchoring'] }),
        ],
      };

      const round = service.selectRound(bank, { count: 2, categories: ['fallacy'] });

      expect(round).toHaveLength(2);
      for (const question of round) {
        expect(['fallacy-1', 'fallacy-2']).toContain(question.id);
      }
    });

    it('narrows the pool by trait id', () => {
      const service = new QuizEngineService();
      const bank = {
        questions: [
          makeQuestion({ id: 'fallacy-1', category: 'fallacy', tags: ['strawman'] }),
          makeQuestion({ id: 'fallacy-2', category: 'fallacy', tags: ['strawman'] }),
          makeQuestion({ id: 'bias-1', category: 'bias', tags: ['anchoring'] }),
          makeQuestion({ id: 'bias-2', category: 'bias', tags: ['anchoring'] }),
        ],
      };

      const round = service.selectRound(bank, { count: 2, traitIds: ['anchoring'] });

      expect(round).toHaveLength(2);
      for (const question of round) {
        expect(['bias-1', 'bias-2']).toContain(question.id);
      }
    });

    it('excludes avoidIds when the pool allows it', () => {
      const service = new QuizEngineService();
      const bank = {
        questions: [
          makeQuestion({ id: 'q1', tags: ['strawman'] }),
          makeQuestion({ id: 'q2', tags: ['strawman'] }),
          makeQuestion({ id: 'q3', tags: ['strawman'] }),
        ],
      };

      const round = service.selectRound(bank, {
        count: 2,
        avoidIds: new Set(['q1']),
      });

      expect(round).toHaveLength(2);
      const ids = round.map((question) => question.id);
      expect(ids).not.toContain('q1');
      expect(ids.sort()).toEqual(['q2', 'q3']);
    });

    it('biases selection toward weighted weak traits over many draws', () => {
      const service = new QuizEngineService();
      const bank = {
        questions: [
          makeQuestion({ id: 'weak-1', tags: ['weak-trait'] }),
          makeQuestion({ id: 'weak-2', tags: ['weak-trait'] }),
          makeQuestion({ id: 'strong-1', tags: ['strong-trait'] }),
          makeQuestion({ id: 'strong-2', tags: ['strong-trait'] }),
        ],
      };

      let weakTraitHits = 0;
      const draws = 300;

      for (let i = 0; i < draws; i++) {
        const round = service.selectRound(bank, {
          count: 1,
          weakTraitWeights: { 'weak-trait': 10, 'strong-trait': 1 },
        });
        if (round[0].id.startsWith('weak-')) {
          weakTraitHits++;
        }
      }

      // Unweighted expectation would be ~50%; weighting should push this well above chance.
      expect(weakTraitHits / draws).toBeGreaterThan(0.7);
    });

    it('maps each question\'s tags to traitIds on the returned RoundQuestion as a copy', () => {
      const service = new QuizEngineService();
      const tags = ['strawman', 'anchoring'];
      const bank = {
        questions: [makeQuestion({ id: 'q1', tags })],
      };

      const round = service.selectRound(bank, { count: 1 });

      expect(round).toHaveLength(1);
      expect(round[0].traitIds).toEqual(tags);
      expect(round[0].traitIds).not.toBe(tags);
    });

    it('awards partial credit as not correct and reports missed/extra selections', () => {
      const service = new QuizEngineService();
      const question = makeRoundQuestion({ id: 'q1', correctAnswers: ['A', 'B'] });

      const result = service.score(question, ['A']);

      expect(result.correct).toBe(false);
      expect(result.missed).toEqual(['B']);
      expect(result.extra).toEqual([]);
    });

    it('reports extra selections that are not in the correct answers', () => {
      const service = new QuizEngineService();
      const question = makeRoundQuestion({ id: 'q1', correctAnswers: ['A', 'B'] });

      const result = service.score(question, ['A', 'C']);

      expect(result.correct).toBe(false);
      expect(result.missed).toEqual(['B']);
      expect(result.extra).toEqual(['C']);
    });

    it('scores an exact match as correct with no missed or extra answers', () => {
      const service = new QuizEngineService();
      const question = makeRoundQuestion({ id: 'q1', correctAnswers: ['A', 'B'] });

      const result = service.score(question, ['A', 'B']);

      expect(result.correct).toBe(true);
      expect(result.missed).toEqual([]);
      expect(result.extra).toEqual([]);
    });

    it('scores a "no trap" question correctly when nothing is selected', () => {
      const service = new QuizEngineService();
      const question = makeRoundQuestion({
        id: 'no-trap-1',
        correctAnswers: ['No trap present'],
      });

      const result = service.score(question, []);

      expect(result.correct).toBe(false);
      expect(result.missed).toEqual(['No trap present']);
      expect(result.extra).toEqual([]);
    });
  });
});
