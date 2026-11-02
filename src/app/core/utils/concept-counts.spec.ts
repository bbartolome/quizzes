import { describe, it, expect } from 'vitest';
import { QuizStats } from '../models/quiz.models';
import { pooledConceptCounts } from './concept-counts';

function stats(
  quizId: string,
  perTrait: Record<string, { correct: number; attempted: number }>,
): QuizStats {
  const traits: QuizStats['perTrait'] = {};
  for (const [id, counts] of Object.entries(perTrait)) {
    traits[id] = { traitId: id, ...counts };
  }
  return { quizId, version: 1, perTrait: traits, streak: 0, roundsPlayed: 0 };
}

const VALID = new Set(['anchoring', 'framing', 'hasty-generalisation']);

describe('pooledConceptCounts', () => {
  it('returns an empty map for no records', () => {
    expect(pooledConceptCounts([], VALID).size).toBe(0);
  });

  it('reports the counts of a single record for valid ids', () => {
    const records = [stats('biases', { anchoring: { correct: 3, attempted: 5 } })];

    const counts = pooledConceptCounts(records, VALID);

    expect(counts.get('anchoring')).toEqual({ attempted: 5, correct: 3 });
  });

  it('sums a concept across records', () => {
    const records = [
      stats('reasoning-traps', { anchoring: { correct: 2, attempted: 3 } }),
      stats('biases', { anchoring: { correct: 4, attempted: 4 } }),
      stats('fallacies', { anchoring: { correct: 1, attempted: 2 } }),
    ];

    const counts = pooledConceptCounts(records, VALID);

    expect(counts.get('anchoring')).toEqual({ attempted: 9, correct: 7 });
  });

  it('keeps concepts separate', () => {
    const records = [
      stats('biases', {
        anchoring: { correct: 1, attempted: 2 },
        framing: { correct: 0, attempted: 4 },
      }),
    ];

    const counts = pooledConceptCounts(records, VALID);

    expect(counts.get('anchoring')).toEqual({ attempted: 2, correct: 1 });
    expect(counts.get('framing')).toEqual({ attempted: 4, correct: 0 });
  });

  it('drops ids that are not in validIds, such as the sound-reasoning pseudo-trait', () => {
    const records = [
      stats('reasoning-traps', {
        'sound-reasoning': { correct: 5, attempted: 6 },
        anchoring: { correct: 1, attempted: 1 },
      }),
    ];

    const counts = pooledConceptCounts(records, VALID);

    expect(counts.has('sound-reasoning')).toBe(false);
    expect(counts.get('anchoring')).toEqual({ attempted: 1, correct: 1 });
    expect(counts.size).toBe(1);
  });

  it('does not mutate its inputs', () => {
    const records = [stats('biases', { anchoring: { correct: 1, attempted: 2 } })];
    const before = JSON.parse(JSON.stringify(records));

    pooledConceptCounts(records, VALID);

    expect(records).toEqual(before);
  });
});
