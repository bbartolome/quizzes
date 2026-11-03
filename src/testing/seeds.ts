import type { Rng } from '../app/features/game-theory/lib/rng.types';

/**
 * Runs fn once per seed 0..n-1. Property tests use this to sweep many seeds (spec §4.2).
 * fn comes first so the default n can be used: forSeeds((seed) => ...).
 */
export function forSeeds(fn: (seed: number) => void, n = 500): void {
  for (let seed = 0; seed < n; seed++) {
    fn(seed);
  }
}

/**
 * An rng that returns the given values in order, so a test can pin exact draws.
 * It throws once exhausted, so a generator that draws more than the test expects fails loudly.
 */
export function scripted(...values: number[]): Rng {
  let next = 0;
  return () => {
    if (next >= values.length) {
      throw new Error(`scripted rng exhausted after ${values.length} draws`);
    }
    return values[next++];
  };
}
