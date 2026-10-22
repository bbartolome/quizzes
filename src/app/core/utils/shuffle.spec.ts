import { describe, it, expect, vi } from 'vitest';
import { shuffle } from './shuffle';

// Park-Miller minimal standard generator, deterministic for a given seed.
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('shuffle', () => {
  it('returns a new array and does not mutate the input', () => {
    const input = ['a', 'b', 'c', 'd'];
    const before = [...input];

    const output = shuffle(input, seededRng(1));

    expect(output).not.toBe(input);
    expect(input).toEqual(before);
  });

  it('returns a permutation of the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    for (let seed = 1; seed <= 50; seed++) {
      const output = shuffle(input, seededRng(seed));
      expect([...output].sort()).toEqual([...input].sort());
    }
  });

  it('makes n - 1 rng calls for n elements', () => {
    for (const n of [2, 3, 4, 7]) {
      const rng = vi.fn(seededRng(3));
      const input = Array.from({ length: n }, (_, i) => i);

      shuffle(input, rng);

      expect(rng).toHaveBeenCalledTimes(n - 1);
    }
  });

  it('makes no rng calls for 0 or 1 elements', () => {
    const rng = vi.fn(seededRng(3));

    expect(shuffle([], rng)).toEqual([]);
    expect(shuffle(['only'], rng)).toEqual(['only']);
    expect(rng).not.toHaveBeenCalled();
  });

  it('with rng () => 0 produces the hand-derived Fisher-Yates order', () => {
    // [a, b, c, d]
    // i=3, j=0: swap 3 and 0 -> [d, b, c, a]
    // i=2, j=0: swap 2 and 0 -> [c, b, d, a]
    // i=1, j=0: swap 1 and 0 -> [b, c, d, a]
    expect(shuffle(['a', 'b', 'c', 'd'], () => 0)).toEqual(['b', 'c', 'd', 'a']);
  });
});
