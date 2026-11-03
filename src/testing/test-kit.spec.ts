import { describe, expect, it } from 'vitest';
import { bruteForcePureNash } from './brute-force-nash';
import { CANONICAL_GAMES, eightSymmetries } from './gt-fixtures';
import { forSeeds, scripted } from './seeds';

describe('forSeeds', () => {
  it('runs 500 seeds, 0 to 499, by default', () => {
    const seen: number[] = [];
    forSeeds((seed) => seen.push(seed));
    expect(seen).toHaveLength(500);
    expect(seen[0]).toBe(0);
    expect(seen[499]).toBe(499);
  });

  it('takes a custom count', () => {
    let runs = 0;
    forSeeds(() => runs++, 7);
    expect(runs).toBe(7);
  });
});

describe('scripted', () => {
  it('returns the values in order, then throws when exhausted', () => {
    const rng = scripted(0.1, 0.9);
    expect(rng()).toBe(0.1);
    expect(rng()).toBe(0.9);
    expect(() => rng()).toThrow(/exhausted after 2 draws/);
  });
});

describe('canonical games and the reference solver', () => {
  // Expected pure Nash cells, from the payoffs in spec §5.1.
  const expected: Record<keyof typeof CANONICAL_GAMES, { r: number; c: number }[]> = {
    'prisoners-dilemma': [{ r: 1, c: 1 }],
    'stag-hunt': [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ],
    'chicken-game': [
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ],
    'battle-of-the-sexes': [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ],
    'coordination-game': [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ],
  };

  it.each(Object.keys(expected) as (keyof typeof expected)[])(
    'finds the pure equilibria of %s',
    (name) => {
      expect(bruteForcePureNash(CANONICAL_GAMES[name])).toEqual(expected[name]);
    },
  );

  it.each(Object.keys(expected) as (keyof typeof expected)[])(
    'keeps the pure equilibrium count of %s under all 8 relabellings',
    (name) => {
      const count = bruteForcePureNash(CANONICAL_GAMES[name]).length;
      for (const variant of eightSymmetries(CANONICAL_GAMES[name])) {
        expect(bruteForcePureNash(variant)).toHaveLength(count);
      }
    },
  );

  it('lists the original game first among its 8 relabellings', () => {
    const game = CANONICAL_GAMES['stag-hunt'];
    expect(eightSymmetries(game)).toHaveLength(8);
    expect(eightSymmetries(game)[0]).toEqual(game);
  });
});
