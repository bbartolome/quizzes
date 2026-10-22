/**
 * Fisher-Yates shuffle with an injected rng. Returns a new array; the input is not mutated.
 * Makes n - 1 rng calls for n elements (0 for n <= 1).
 */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
