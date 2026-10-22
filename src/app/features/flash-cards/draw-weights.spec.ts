import { describe, it, expect } from 'vitest';
import {
  applyBump,
  candidates,
  drawTarget,
  drawWeight,
  effectiveWeight,
  pickTarget,
  pooledCounts,
} from './draw-weights';
import { Concept, KnowledgeBase, QuizStats } from '../../core/models/quiz.models';

function concept(id: string, type: Concept['type'] = 'fallacy'): Concept {
  return {
    id,
    name: id.toUpperCase(),
    type,
    shortDefinition: `${id} short`,
    longExplanation: 'l',
    example: `${id} example`,
  };
}

const A = concept('a');
const B = concept('b');
const C = concept('c');
const D = concept('d', 'bias');

const deck: Concept[] = [A, B, C];

const kb: KnowledgeBase = {
  concepts: [A, B, C, D],
  pairs: [{ concepts: ['a', 'b'] }, { concepts: ['a', 'd'] }],
};

function stats(
  quizId: string,
  perTrait: Record<string, { correct: number; attempted: number }>,
): QuizStats {
  const traits: QuizStats['perTrait'] = {};
  for (const [traitId, counts] of Object.entries(perTrait)) {
    traits[traitId] = { traitId, ...counts };
  }
  return { quizId, version: 1, perTrait: traits, streak: 0, roundsPlayed: 0 };
}

describe('pooledCounts', () => {
  // SPEC line 153
  it('adds counts across reasoning-traps and the kind, and treats missing as 0/0', () => {
    const traps = stats('reasoning-traps', { a: { correct: 3, attempted: 5 } });
    const kind = stats('biases', {
      a: { correct: 2, attempted: 4 },
      c: { correct: 1, attempted: 2 },
    });

    const pooled = pooledCounts(deck, traps, kind);

    expect(pooled.get('a')).toEqual({ correct: 5, attempted: 9 });
    expect(pooled.get('b')).toEqual({ correct: 0, attempted: 0 });
    expect(pooled.get('c')).toEqual({ correct: 1, attempted: 2 });
  });

  // SPEC line 153: "For each deck concept"
  it('ignores perTrait keys that are not in the deck', () => {
    const traps = stats('reasoning-traps', { d: { correct: 4, attempted: 4 } });
    const kind = stats('biases', { z: { correct: 9, attempted: 9 } });

    const pooled = pooledCounts(deck, traps, kind);

    expect([...pooled.keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(pooled.get('a')).toEqual({ correct: 0, attempted: 0 });
  });
});

describe('drawWeight', () => {
  // SPEC line 154
  it('gives the exact values from the formula 1 + 2 * (1 - p)', () => {
    expect(drawWeight(0, 0)).toBe(2);
    expect(drawWeight(5, 5)).toBeCloseTo(7 / 6, 10);
    expect(drawWeight(0, 1)).toBeCloseTo(5 / 2, 10);
    expect(drawWeight(10, 10)).toBeCloseTo(12 / 11, 10);
    expect(drawWeight(0, 10)).toBeCloseTo(32 / 11, 10);
  });
});

describe('candidates', () => {
  // SPEC line 156
  it('excludes the previous target, keeping deck order', () => {
    expect(candidates(deck, B)).toEqual([A, C]);
  });

  // DECISION: the spec is silent on an empty candidate set; fall back to the full deck.
  it('falls back to the full deck when excluding the previous target leaves nothing', () => {
    expect(candidates([A], A)).toEqual([A]);
  });

  it('returns the full deck when there is no previous target', () => {
    expect(candidates(deck, null)).toEqual(deck);
  });
});

describe('effectiveWeight', () => {
  // SPEC line 157
  it('adds 1 for a bumped concept and caps the result at 3', () => {
    expect(effectiveWeight(1, false)).toBe(1);
    expect(effectiveWeight(1, true)).toBe(2);
    expect(effectiveWeight(2, true)).toBe(3);
    expect(effectiveWeight(3, true)).toBe(3);
    expect(effectiveWeight(3, false)).toBe(3);
  });
});

describe('pickTarget', () => {
  it('picks by cumulative weight in pool order, one rng call per pick', () => {
    const pool = [A, B, C];
    const weights = [1, 2, 3];
    expect(pickTarget(pool, weights, () => 0.0)).toBe(A);
    expect(pickTarget(pool, weights, () => 0.5)).toBe(C);
    expect(pickTarget(pool, weights, () => 0.99)).toBe(C);
  });

  // SPEC line 156 for the mechanism; the algorithm is DECISION.
  it('gives the expected sequence when the previous target is removed between picks', () => {
    const rngValues = [0.0, 0.5, 0.99];
    let previous: Concept | null = null;
    const picks: Concept[] = [];
    for (const r of rngValues) {
      const pool: readonly Concept[] = candidates(deck, previous);
      const picked: Concept = pickTarget(
        pool,
        pool.map(() => 2),
        () => r,
      );
      picks.push(picked);
      previous = picked;
    }
    expect(picks).toEqual([A, C, B]);
  });
});

describe('drawTarget', () => {
  // SPEC lines 156-157; algorithm is DECISION.
  it('lets a bumped lure win the pick that it would otherwise lose', () => {
    const baseWeightMap = new Map([
      ['a', 2],
      ['b', 2],
      ['c', 2],
    ]);
    // Bumped: effective [2, 3, 2], total 7, r = 4.76 falls in B.
    expect(drawTarget(deck, null, baseWeightMap, new Set(['b']), () => 0.68)).toBe(B);
    // Not bumped: effective [2, 2, 2], total 6, r = 4.08 falls in C.
    expect(drawTarget(deck, null, baseWeightMap, new Set(), () => 0.68)).toBe(C);
  });

  // SPEC line 157: "A lure from the other deck can't be a target in this round"
  it('never picks a concept outside the deck, even when it is bumped', () => {
    const baseWeightMap = new Map([
      ['a', 2],
      ['b', 2],
      ['c', 2],
    ]);
    const picked = drawTarget(deck, null, baseWeightMap, new Set(['d']), () => 0.99);
    expect([A, B, C]).toContain(picked);
    expect(picked).not.toBe(D);
  });
});

describe('applyBump', () => {
  // SPEC line 157
  it('adds the picked id when the picked concept is a confused partner of the target', () => {
    const bumped = applyBump(new Set(), A, B, kb);
    expect(bumped.has('b')).toBe(true);
  });

  // SPEC line 157
  it('leaves the set unchanged when the picked concept is not a partner', () => {
    const bumped = applyBump(new Set(), A, C, kb);
    expect([...bumped]).toEqual([]);
  });

  // DECISION: pure function, does not mutate its input (S3/S4 pattern).
  it('does not mutate the input set', () => {
    const input = new Set(['x']);
    const bumped = applyBump(input, A, B, kb);
    expect([...input]).toEqual(['x']);
    expect(bumped).not.toBe(input);
    expect(bumped.has('b')).toBe(true);
  });
});
