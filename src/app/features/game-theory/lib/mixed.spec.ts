import { describe, expect, it } from 'vitest';
import { CANONICAL_GAMES } from '../../../../testing/gt-fixtures';
import { forSeeds } from '../../../../testing/seeds';
import { mixedNash2x2 } from './mixed';
import type { Fraction, MixedNash2x2, PayoffMatrix } from './matrix.types';

// Same algorithm as mulberry32 (spec §4.1). rng.ts lands in G2, so this spec carries its own copy.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic 2x2 integer game with payoffs in 0..max. */
function randomGame2x2(seed: number, max: number): PayoffMatrix {
  const draw = prng(seed);
  const grid = () => [
    [Math.floor(draw() * (max + 1)), Math.floor(draw() * (max + 1))],
    [Math.floor(draw() * (max + 1)), Math.floor(draw() * (max + 1))],
  ];
  return { rows: 2, cols: 2, row: grid(), col: grid() };
}

// Exact fraction arithmetic for the checks. Equality is by cross-multiplication, never by floats.
const whole = (n: number): Fraction => ({ num: n, den: 1 });
const add = (a: Fraction, b: Fraction): Fraction => ({
  num: a.num * b.den + b.num * a.den,
  den: a.den * b.den,
});
const sub = (a: Fraction, b: Fraction): Fraction => ({
  num: a.num * b.den - b.num * a.den,
  den: a.den * b.den,
});
const mul = (a: Fraction, b: Fraction): Fraction => ({ num: a.num * b.num, den: a.den * b.den });
const same = (a: Fraction, b: Fraction): boolean => a.num * b.den === b.num * a.den;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** The expected payoff of a row strategy against a column mix that plays column 0 with weight q. */
function rowPayoff(m: PayoffMatrix, row: number, q: Fraction): Fraction {
  const one = whole(1);
  return add(mul(q, whole(m.row[row][0])), mul(sub(one, q), whole(m.row[row][1])));
}

/** The expected payoff of a column strategy against a row mix that plays row 0 with weight p. */
function colPayoff(m: PayoffMatrix, col: number, p: Fraction): Fraction {
  const one = whole(1);
  return add(mul(p, whole(m.col[0][col])), mul(sub(one, p), whole(m.col[1][col])));
}

/** Both players are indifferent between their pure strategies, checked exactly, and the values match. */
function expectExactIndifference(m: PayoffMatrix, result: MixedNash2x2): void {
  expect(same(rowPayoff(m, 0, result.q), rowPayoff(m, 1, result.q))).toBe(true);
  expect(same(colPayoff(m, 0, result.p), colPayoff(m, 1, result.p))).toBe(true);
  expect(same(rowPayoff(m, 0, result.q), result.rowValue)).toBe(true);
  expect(same(colPayoff(m, 0, result.p), result.colValue)).toBe(true);
}

describe('mixedNash2x2 on known games', () => {
  it('finds the mix in Battle of the Sexes, which favours a different game for each player', () => {
    const result = mixedNash2x2(CANONICAL_GAMES['battle-of-the-sexes']);
    expect(result).toEqual({
      p: { num: 2, den: 3 },
      q: { num: 1, den: 3 },
      rowValue: { num: 2, den: 3 },
      colValue: { num: 2, den: 3 },
    });
  });

  it('finds the even mix in Matching Pennies, with value zero', () => {
    const pennies: PayoffMatrix = {
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
    expect(mixedNash2x2(pennies)).toEqual({
      p: { num: 1, den: 2 },
      q: { num: 1, den: 2 },
      rowValue: { num: 0, den: 1 },
      colValue: { num: 0, den: 1 },
    });
  });

  it('finds the even mix in pure coordination, with value one half', () => {
    expect(mixedNash2x2(CANONICAL_GAMES['coordination-game'])).toEqual({
      p: { num: 1, den: 2 },
      q: { num: 1, den: 2 },
      rowValue: { num: 1, den: 2 },
      colValue: { num: 1, den: 2 },
    });
  });

  it('finds the even mix in Chicken, with value five halves', () => {
    expect(mixedNash2x2(CANONICAL_GAMES['chicken-game'])).toEqual({
      p: { num: 1, den: 2 },
      q: { num: 1, den: 2 },
      rowValue: { num: 5, den: 2 },
      colValue: { num: 5, den: 2 },
    });
  });

  it('finds the even mix in Stag Hunt, with value five halves', () => {
    expect(mixedNash2x2(CANONICAL_GAMES['stag-hunt'])).toEqual({
      p: { num: 1, den: 2 },
      q: { num: 1, den: 2 },
      rowValue: { num: 5, den: 2 },
      colValue: { num: 5, den: 2 },
    });
  });
});

describe('mixedNash2x2 returns null', () => {
  it("when the Prisoner's Dilemma denominator is zero (no interior mix)", () => {
    expect(mixedNash2x2(CANONICAL_GAMES['prisoners-dilemma'])).toBeNull();
  });

  it("when a player's mix would sit on the boundary, here q = 0", () => {
    const boundary: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [2, 0],
        [1, 0],
      ],
      col: [
        [1, 0],
        [0, 1],
      ],
    };
    expect(mixedNash2x2(boundary)).toBeNull();
  });

  it('when a mix would fall outside (0, 1), here p = 2', () => {
    const outside: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [1, 0],
        [0, 1],
      ],
      col: [
        [1, 0],
        [3, 1],
      ],
    };
    expect(mixedNash2x2(outside)).toBeNull();
  });

  it('when the game is not 2x2', () => {
    const wide: PayoffMatrix = {
      rows: 2,
      cols: 3,
      row: [
        [1, 0, 2],
        [0, 1, 2],
      ],
      col: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    };
    expect(mixedNash2x2(wide)).toBeNull();
  });
});

describe('mixedNash2x2 exactness', () => {
  it('satisfies the indifference equations exactly on the known games', () => {
    for (const game of [
      CANONICAL_GAMES['battle-of-the-sexes'],
      CANONICAL_GAMES['chicken-game'],
      CANONICAL_GAMES['stag-hunt'],
      CANONICAL_GAMES['coordination-game'],
    ]) {
      const result = mixedNash2x2(game);
      expect(result).not.toBeNull();
      expectExactIndifference(game, result as MixedNash2x2);
    }
  });

  it('returns reduced fractions with a positive denominator, and indifference holds, on 500 seeded games', () => {
    forSeeds((seed) => {
      const game = randomGame2x2(seed, 4);
      const result = mixedNash2x2(game);
      if (result === null) {
        return;
      }
      for (const f of [result.p, result.q, result.rowValue, result.colValue]) {
        expect(f.den).toBeGreaterThan(0);
        expect(gcd(f.num, f.den)).toBe(1);
      }
      expect(result.p.num).toBeGreaterThan(0);
      expect(result.p.num).toBeLessThan(result.p.den);
      expect(result.q.num).toBeGreaterThan(0);
      expect(result.q.num).toBeLessThan(result.q.den);
      expectExactIndifference(game, result);
    });
  });
});
