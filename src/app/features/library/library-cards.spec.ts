import { describe, it, expect } from 'vitest';
import { QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
import { skillScore } from '../calibration/scoring';
import {
  calibrationCard,
  conceptIdsFor,
  formatPercent,
  gameTheoryCard,
  routeFor,
  statsCard,
} from './library-cards';

const entry = (over: Partial<QuizManifestEntry> = {}): QuizManifestEntry => ({
  id: 'biases',
  title: 'Biases',
  description: 'Spot the bias',
  icon: 'x',
  version: 1,
  order: 1,
  kind: 'biases',
  ...over,
});

const stats = (over: Partial<QuizStats> = {}): QuizStats => ({
  quizId: 'biases',
  version: 1,
  perTrait: {},
  streak: 0,
  roundsPlayed: 0,
  ...over,
});

describe('routeFor', () => {
  it('prefixes each kind with its own URL space', () => {
    expect(routeFor(entry({ kind: 'traps', id: 'reasoning-traps' }))).toBe('/quiz/reasoning-traps');
    expect(routeFor(entry({ kind: 'calibration', id: 'confidence' }))).toBe(
      '/calibration/confidence',
    );
    expect(routeFor(entry({ kind: 'biases', id: 'biases' }))).toBe('/biases/biases');
    expect(routeFor(entry({ kind: 'fallacies', id: 'fallacies' }))).toBe('/fallacies/fallacies');
  });

  it('gives the game-theory hub one fixed path with no :id segment', () => {
    expect(routeFor(entry({ kind: 'game-theory', id: 'game-theory' }))).toBe('/game-theory');
  });
});

describe('conceptIdsFor', () => {
  it('returns no flash-card concept ids for game theory', () => {
    const concepts = [
      { id: 'anchoring', name: 'Anchoring', type: 'bias' as const },
      { id: 'ad-hominem', name: 'Ad hominem', type: 'fallacy' as const },
    ].map((c) => ({
      ...c,
      shortDefinition: '',
      longExplanation: '',
      example: '',
    }));
    expect(conceptIdsFor('game-theory', concepts)).toEqual([]);
  });
});

describe('gameTheoryCard', () => {
  const learn = { mastered: 2, introduced: 5, total: 18 };
  const hub = entry({ kind: 'game-theory', id: 'game-theory' });

  it('reads rounds, accuracy and mastery from the game-theory stats and the learn summary', () => {
    const card = gameTheoryCard(hub, learn, {
      cards: stats({
        quizId: 'game-theory:cards',
        roundsPlayed: 3,
        perTrait: {
          'dominant-strategy': { traitId: 'dominant-strategy', attempted: 4, correct: 3 },
        },
      }),
      challenges: stats({
        quizId: 'game-theory:challenges',
        perTrait: {
          'nash-equilibrium': { traitId: 'nash-equilibrium', attempted: 2, correct: 1 },
        },
      }),
    });
    expect(card).toMatchObject({
      kind: 'game-theory',
      roundsPlayed: 3,
      attempted: 6,
      correct: 4,
      accuracy: 4 / 6,
      streak: 0,
      conceptsPractised: 2,
      conceptsTotal: 18,
    });
  });

  it('has no accuracy before the first attempt', () => {
    const card = gameTheoryCard(hub, learn, {
      cards: stats({ quizId: 'game-theory:cards' }),
      challenges: stats({ quizId: 'game-theory:challenges' }),
    });
    expect(card.accuracy).toBeNull();
  });

  it('uses the fixed 18 concepts as the denominator, whatever the summary total says', () => {
    const card = gameTheoryCard(
      hub,
      { mastered: 0, introduced: 0, total: 0 },
      {
        cards: stats({ quizId: 'game-theory:cards' }),
        challenges: stats({ quizId: 'game-theory:challenges' }),
      },
    );
    expect(card.conceptsTotal).toBe(18);
  });
});

describe('formatPercent', () => {
  it('rounds a fraction to a whole percent', () => {
    expect(formatPercent(0.756)).toBe('76%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('statsCard', () => {
  it('sums correct and attempted across traits and derives accuracy', () => {
    const card = statsCard(
      entry(),
      stats({
        streak: 2,
        roundsPlayed: 5,
        perTrait: {
          a: { traitId: 'a', correct: 2, attempted: 4 },
          b: { traitId: 'b', correct: 1, attempted: 4 },
        },
      }),
    );

    expect(card).toEqual({
      entry: entry(),
      kind: 'biases',
      streak: 2,
      roundsPlayed: 5,
      correct: 3,
      attempted: 8,
      accuracy: 0.375,
      skillScore: null,
      conceptsPractised: null,
      conceptsTotal: null,
    });
  });

  it('leaves accuracy null until something is attempted', () => {
    expect(statsCard(entry(), stats()).accuracy).toBeNull();
  });
});

describe('calibrationCard', () => {
  it('has no skill score before any answer is recorded', () => {
    const card = calibrationCard(entry({ kind: 'calibration' }), {
      roundsPlayed: 2,
      brierSum: 0,
      answerCount: 0,
    });

    expect(card).toEqual({
      entry: entry({ kind: 'calibration' }),
      kind: 'calibration',
      streak: 0,
      roundsPlayed: 2,
      correct: 0,
      attempted: 0,
      accuracy: null,
      skillScore: null,
      conceptsPractised: null,
      conceptsTotal: null,
    });
  });

  it('scores with the format declared on the entry', () => {
    const card = calibrationCard(entry({ kind: 'calibration', format: 'four-way' }), {
      roundsPlayed: 1,
      brierSum: 1,
      answerCount: 4,
    });

    expect(card.skillScore).toBe(skillScore(0.25, 'four-way'));
  });
});
