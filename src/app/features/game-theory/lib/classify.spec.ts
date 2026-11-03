import { describe, expect, it } from 'vitest';
import { CANONICAL_GAMES, eightSymmetries } from '../../../../testing/gt-fixtures';
import { forSeeds } from '../../../../testing/seeds';
import { CLASS_TEMPLATES, canonicalSignature, classify2x2 } from './classify';
import type { GameClass, PayoffMatrix } from './matrix.types';
import { mulberry32 as prng } from './rng';

type Canonical = Exclude<GameClass, 'other'>;

const CLASSES: Canonical[] = [
  'prisoners-dilemma',
  'stag-hunt',
  'chicken-game',
  'battle-of-the-sexes',
  'coordination-game',
];

/** A deterministic 2x2 integer game with payoffs in 0..max. */
function randomGame2x2(seed: number, max: number): PayoffMatrix {
  const draw = prng(seed);
  const grid = () => [
    [Math.floor(draw() * (max + 1)), Math.floor(draw() * (max + 1))],
    [Math.floor(draw() * (max + 1)), Math.floor(draw() * (max + 1))],
  ];
  return { rows: 2, cols: 2, row: grid(), col: grid() };
}

/** A symmetric 2x2 game from R, S, T and P, laid out as in spec §5.1. */
function symmetric(R: number, S: number, T: number, P: number): PayoffMatrix {
  return {
    rows: 2,
    cols: 2,
    row: [
      [R, S],
      [T, P],
    ],
    col: [
      [R, T],
      [S, P],
    ],
  };
}

const MATCHING_PENNIES: PayoffMatrix = {
  rows: 2,
  cols: 2,
  row: [
    [1, -1],
    [-1, 1],
  ],
  col: [
    [-1, 1],
    [1, -1],
  ],
};

describe('classification templates', () => {
  it('gives the five templates five distinct signatures', () => {
    const signatures = CLASSES.map((cls) => canonicalSignature(CLASS_TEMPLATES[cls]).join(','));
    expect(new Set(signatures).size).toBe(5);
  });

  it('builds each template from the §5.1 canonical game of the same name', () => {
    for (const cls of CLASSES) {
      expect(CLASS_TEMPLATES[cls]).toEqual(CANONICAL_GAMES[cls]);
    }
  });
});

describe('classify2x2', () => {
  it.each(CLASSES)('classifies the canonical %s game as its own class', (cls) => {
    expect(classify2x2(CANONICAL_GAMES[cls])).toBe(cls);
  });

  it('uses only the order of the payoffs, not their size', () => {
    expect(classify2x2(symmetric(6, 0, 10, 2))).toBe('prisoners-dilemma');
    expect(classify2x2(symmetric(40, 10, 30, 20))).toBe('stag-hunt');
    expect(classify2x2(symmetric(30, 20, 40, 10))).toBe('chicken-game');
  });

  it('gives the same class under all 8 relabellings of each canonical game', () => {
    for (const cls of CLASSES) {
      for (const variant of eightSymmetries(CANONICAL_GAMES[cls])) {
        expect(classify2x2(variant)).toBe(cls);
      }
    }
  });

  it('gives the same class and signature under all 8 relabellings of 500 seeded games', () => {
    forSeeds((seed) => {
      const game = randomGame2x2(seed, 3);
      const cls = classify2x2(game);
      const signature = canonicalSignature(game).join(',');
      for (const variant of eightSymmetries(game)) {
        expect(classify2x2(variant)).toBe(cls);
        expect(canonicalSignature(variant).join(',')).toBe(signature);
      }
    });
  });

  it('returns other for matching pennies, which no template matches', () => {
    expect(classify2x2(MATCHING_PENNIES)).toBe('other');
    for (const variant of eightSymmetries(MATCHING_PENNIES)) {
      expect(classify2x2(variant)).toBe('other');
    }
  });

  it('returns other when every payoff is equal', () => {
    const flat: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [1, 1],
        [1, 1],
      ],
      col: [
        [1, 1],
        [1, 1],
      ],
    };
    expect(classify2x2(flat)).toBe('other');
  });

  it('returns other for a game that is not 2x2', () => {
    const wide: PayoffMatrix = {
      rows: 2,
      cols: 3,
      row: [
        [3, 0, 1],
        [4, 1, 2],
      ],
      col: [
        [3, 4, 0],
        [0, 1, 2],
      ],
    };
    expect(classify2x2(wide)).toBe('other');
  });
});
