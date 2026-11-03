import { describe, expect, it } from 'vitest';
import { forSeeds } from '../../../../testing/seeds';
import { hashSeed, mulberry32 } from './rng';

// Reference algorithms, as published in bryc/code jshash/PRNGs.md (xmur3 "Addendum A", and mulberry32).
// Every value is uint32. Math.imul is the 32-bit multiply, and >>> is the unsigned shift.
//
// xmur3(str), the string hash:
//   h = 1779033703 ^ str.length
//   for each UTF-16 code unit c of str:
//     h = imul(h ^ c, 3432918353)
//     h = (h << 13) | (h >>> 19)              rotate left by 13
//   the returned closure, called once, does:
//     h = imul(h ^ (h >>> 16), 2246822507)
//     h = imul(h ^ (h >>> 13), 3266489909)
//     h = h ^ (h >>> 16)
//     return h >>> 0
//
// hashSeed(s) is the first value the xmur3 closure returns for s.
//
// mulberry32(a), the generator:
//   a = (a + 0x6d2b79f5) | 0
//   t = imul(a ^ (a >>> 15), 1 | a)
//   t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t
//   return ((t ^ (t >>> 14)) >>> 0) / 4294967296
//
// The pinned values below were not read from this module. They come from the steps above,
// worked in two separate arithmetic setups (arbitrary-precision integers with explicit 32-bit
// masks, and BigInt with asUintN), and the two agreed on every value.

function draw(next: () => number, n: number): number[] {
  return Array.from({ length: n }, () => next());
}

describe('hashSeed (xmur3)', () => {
  it.each([
    ['', 167010153],
    ['a', 519299066],
    ['abc', 1792905582],
    ['daily:2026-11-03', 3120556586],
  ])('hashes %j to %i', (key, expected) => {
    expect(hashSeed(key)).toBe(expected);
  });

  it('returns a uint32 for seeds 0 to 499', () => {
    const outside: string[] = [];
    forSeeds((seed) => {
      const h = hashSeed(`key-${seed}`);
      if (!Number.isInteger(h) || h < 0 || h > 0xffffffff) outside.push(`key-${seed}`);
    });
    expect(outside).toEqual([]);
  });

  it('is deterministic for a given key', () => {
    expect(hashSeed('daily:2026-11-03')).toBe(hashSeed('daily:2026-11-03'));
  });
});

describe('mulberry32', () => {
  it('pins the first five outputs for seed 0', () => {
    const expected = [1144304738, 1416247, 958946056, 627933444, 2007157716].map(
      (n) => n / 2 ** 32,
    );
    expect(draw(mulberry32(0), 5)).toEqual(expected);
  });

  it('pins the first five outputs for seed 1', () => {
    const expected = [2693262067, 11749833, 2265367787, 4213581821, 4159151403].map(
      (n) => n / 2 ** 32,
    );
    expect(draw(mulberry32(1), 5)).toEqual(expected);
  });

  it('keeps every output in [0, 1) for seeds 0 to 499', () => {
    const outside: number[] = [];
    forSeeds((seed) => {
      for (const v of draw(mulberry32(seed), 200)) {
        if (!(v >= 0 && v < 1)) outside.push(seed);
      }
    });
    expect(outside).toEqual([]);
  });

  it('is deterministic for a given seed, for seeds 0 to 499', () => {
    forSeeds((seed) => {
      expect(draw(mulberry32(seed), 50)).toEqual(draw(mulberry32(seed), 50));
    });
  });

  it('gives a different first output for each of seeds 0 to 499', () => {
    const firsts = new Set<number>();
    forSeeds((seed) => {
      firsts.add(mulberry32(seed)());
    });
    expect(firsts.size).toBe(500);
  });
});
