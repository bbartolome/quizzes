import { describe, it, expect } from 'vitest';
import { Concept, QuizStats } from '../../core/models/quiz.models';
import { deckForKind, progressDisplay } from './home-page-helpers';

function stats(perTrait: QuizStats['perTrait'], roundsPlayed = 0): QuizStats {
  return { quizId: 'biases', version: 1, perTrait, streak: 0, roundsPlayed };
}

function concept(id: string, type: Concept['type']): Concept {
  return {
    id,
    name: `Name ${id}`,
    type,
    shortDefinition: `short ${id}`,
    longExplanation: `long ${id}`,
    example: `example ${id}`,
  };
}

describe('progressDisplay', () => {
  it('H1 gives null for both values with no perTrait entries', () => {
    expect(progressDisplay(stats({}))).toEqual({ roundsPlayed: null, accuracy: null });
  });

  it('H2 sums correct and attempted across all perTrait entries', () => {
    const s = stats(
      {
        a: { traitId: 'a', correct: 1, attempted: 2 },
        b: { traitId: 'b', correct: 3, attempted: 4 },
      },
      2,
    );

    expect(progressDisplay(s)).toEqual({ roundsPlayed: '2', accuracy: '67%' });
  });

  it('H3 rounds accuracy to the nearest whole percent', () => {
    const s = stats({ a: { traitId: 'a', correct: 1, attempted: 3 } }, 1);

    expect(progressDisplay(s).accuracy).toBe('33%');
  });

  it('H4 shows rounds played once at least one answer exists', () => {
    const s = stats({ a: { traitId: 'a', correct: 0, attempted: 1 } }, 5);

    expect(progressDisplay(s)).toEqual({ roundsPlayed: '5', accuracy: '0%' });
  });

  it('H5 shows 0% for zero correct with attempts, not null', () => {
    const s = stats({ a: { traitId: 'a', correct: 0, attempted: 4 } });

    expect(progressDisplay(s).accuracy).toBe('0%');
  });
});

describe('deckForKind', () => {
  it('H6 keeps bundle order and filters by type', () => {
    const concepts = [
      concept('b2', 'bias'),
      concept('f1', 'fallacy'),
      concept('b1', 'bias'),
      concept('f2', 'fallacy'),
    ];

    expect(deckForKind(concepts, 'bias').map((c) => c.id)).toEqual(['b2', 'b1']);
    expect(deckForKind(concepts, 'fallacy').map((c) => c.id)).toEqual(['f1', 'f2']);
  });

  it('H7 returns an empty array when no concept has the type', () => {
    expect(deckForKind([concept('b1', 'bias')], 'fallacy')).toEqual([]);
  });
});
