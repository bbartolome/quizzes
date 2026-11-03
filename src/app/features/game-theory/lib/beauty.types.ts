// Type-only. Copied verbatim from docs/specs/game-theory.md §8.2.
// levelGuess, levelOf and the Monte Carlo runner are implemented by G24.

export type LevelLabel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4+';
export interface BeautyConfig {
  simulated: number; // default 12
  p: number; // default 2/3
  mix: Record<'L0' | 'L1' | 'L2' | 'L3', number>;
  sigma: number;
  seed: string;
}
export interface BeautyResult {
  guesses: number[];
  human: number;
  mean: number; // includes the human's guess
  target: number;
  winnerIndex: number; // -1 means the human won
  humanLevel: LevelLabel;
  levelCounts: Record<LevelLabel, number>;
}
