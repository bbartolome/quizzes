import type { BeautyConfig, BeautyResult, LevelLabel } from './beauty.types';
import { hashSeed, mulberry32 } from './rng';
import type { Rng } from './rng.types';

// Beauty contest engine (spec §8.2). Pure: no Angular, no clock, no Math.random.
//
// Draw order. Every number comes from one seeded stream, mulberry32(hashSeed(config.seed)).
// runBeautyContest(config, human) draws as follows:
//   for each simulated player i = 0 .. simulated - 1, in order:
//     1 draw: the level. The mix weights are read in the order L0, L1, L2, L3 and normalised by
//             their total. The level is the first whose cumulative weight exceeds u · total.
//     then levelGuess(level, rng, config):
//       L0:      1 draw u, guess = 100 · u.
//       Lk, k≥1: 2 draws, u1 first and then u2. Box-Muller gives
//                z = sqrt(-2 · ln(1 - u1)) · cos(2π · u2), so u1 = 0 cannot produce ln 0.
//                The sine branch is discarded, so each normal costs exactly two draws.
//                guess = clip(50 · p^k + sigma · z, 0, 100).
//   The human's guess is an input, so it draws nothing.
// levelGuess(k, rng, shape) draws only what is listed above, from the rng it is given.

const SIMULATED_LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;
const LABELS: LevelLabel[] = ['L0', 'L1', 'L2', 'L3', 'L4+'];
const MAX_LEVEL = 4;

/** The spec §8.2 defaults: 12 simulated players, p = 2/3, mix {L0 .3, L1 .4, L2 .2, L3 .1}, sigma 5. */
export function defaultBeautyConfig(seed: string): BeautyConfig {
  return { simulated: 12, p: 2 / 3, mix: { L0: 0.3, L1: 0.4, L2: 0.2, L3: 0.1 }, sigma: 5, seed };
}

/** The guess of a player at level k. Draw order is in the header comment. */
export function levelGuess(k: number, rng: Rng, shape: { p: number; sigma: number }): number {
  if (k === 0) {
    return 100 * rng();
  }
  const u1 = 1 - rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return clamp(50 * shape.p ** k + shape.sigma * z, 0, 100);
}

/** The nearest k in 0..4 to 50 · p^k. An exact tie goes to the lower k. */
export function levelOf(guess: number, p = 2 / 3): number {
  let best = 0;
  let bestDist = Infinity;
  for (let k = 0; k <= MAX_LEVEL; k++) {
    const dist = Math.abs(guess - 50 * p ** k);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

/**
 * Plays one beauty contest. The target is p times the mean, which includes the human's guess.
 * The winner is the guess closest to the target. A tie goes to the lowest index, and the human
 * is -1, so the human wins a tie.
 * levelCounts counts the simulated players by the level they were assigned, not by levelOf.
 */
export function runBeautyContest(config: BeautyConfig, human: number): BeautyResult {
  const rng = mulberry32(hashSeed(config.seed));
  const total = SIMULATED_LEVELS.reduce((sum, level) => sum + config.mix[level], 0);
  const levelCounts: Record<LevelLabel, number> = { L0: 0, L1: 0, L2: 0, L3: 0, 'L4+': 0 };
  const guesses: number[] = [];

  for (let i = 0; i < config.simulated; i++) {
    const level = pickLevel(config.mix, total, rng());
    levelCounts[LABELS[level]] += 1;
    guesses.push(levelGuess(level, rng, config));
  }

  const sum = guesses.reduce((a, b) => a + b, 0) + human;
  const mean = sum / (config.simulated + 1);
  const target = config.p * mean;

  let winnerIndex = -1;
  let bestDist = Math.abs(human - target);
  guesses.forEach((guess, i) => {
    const dist = Math.abs(guess - target);
    if (dist < bestDist) {
      bestDist = dist;
      winnerIndex = i;
    }
  });

  return {
    guesses,
    human,
    mean,
    target,
    winnerIndex,
    humanLevel: LABELS[levelOf(human, config.p)],
    levelCounts,
  };
}

/** The simulated level index (0..3) for a draw u in [0, 1). */
function pickLevel(mix: BeautyConfig['mix'], total: number, u: number): number {
  let cumulative = 0;
  for (let k = 0; k < SIMULATED_LEVELS.length - 1; k++) {
    cumulative += mix[SIMULATED_LEVELS[k]];
    if (u * total < cumulative) {
      return k;
    }
  }
  return SIMULATED_LEVELS.length - 1;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
