import { describe, expect, it } from 'vitest';
import { forSeeds, scripted } from '../../../../testing/seeds';
import { defaultBeautyConfig, levelGuess, levelOf, runBeautyContest } from './beauty';
import { mulberry32 } from './rng';

// Beauty contest engine (spec §8.2, slice G24). The draw order is documented at the top of beauty.ts.
//
// Monte Carlo (spec §4.2, §8.2):
//   - Seeds: forSeeds() gives seeds 0..499. Each game uses the default config with seed `beauty-mc:<seed>`.
//   - Statistic: the simulated mean (the 12 simulated guesses, without the human), pooled over all
//     500 games, so 6000 simulated guesses in total.
//   - Tolerance: [30, 40], as the spec states. The analytic expectation for the default mix is
//     0.3·50 + 0.4·50p + 0.2·50p² + 0.1·50p³ = 34.26, with p = 2/3. The standard error of the pooled
//     mean is about 0.26, so the band is about 15 standard errors wide on each side.
//   - Normal draw: levelGuess(1) on mulberry32(7), 20000 draws. L1 is never clipped here, so the
//     sample mean should be 100/3 and the sample sd should be sigma = 5, each within ±0.2. The
//     standard error of the sd is about 0.025.

const shape = { p: 2 / 3, sigma: 5 };

describe('levelGuess', () => {
  it('draws L0 uniformly on [0, 100] with a single draw', () => {
    const rng = scripted(0.25, 0.5);
    expect(levelGuess(0, rng, shape)).toBe(25);
    expect(rng()).toBe(0.5);
  });

  it('draws Lk from two draws, with u1 first and the cosine branch of Box-Muller', () => {
    // u2 = 0.25 gives cos(2π·0.25) = 0, so the normal term vanishes and the guess is 50·p.
    expect(levelGuess(1, scripted(0.5, 0.25), shape)).toBeCloseTo(100 / 3, 9);
  });

  it('adds sigma times sqrt(-2 ln(1 - u1)) cos(2π u2) to the level centre', () => {
    // u1 = 0.5 and u2 = 0 give z = sqrt(2 ln 2), so the guess is 50p + 5·sqrt(2 ln 2).
    expect(levelGuess(1, scripted(0.5, 0), shape)).toBeCloseTo(
      100 / 3 + 5 * Math.sqrt(2 * Math.LN2),
      9,
    );
  });

  it('does not produce a non-finite value when the first draw is 0', () => {
    // u1 = 0 maps to 1 - 0 = 1, so ln 1 = 0 and the normal term is 0.
    expect(levelGuess(1, scripted(0, 0.1), shape)).toBeCloseTo(100 / 3, 9);
  });

  it('clips the guess to [0, 100]', () => {
    const wide = { p: 2 / 3, sigma: 1000 };
    expect(levelGuess(1, scripted(0.5, 0), wide)).toBe(100);
    expect(levelGuess(1, scripted(0.5, 0.5), wide)).toBe(0);
  });

  it('draws L1 with mean 50p and sd sigma over 20000 seeded draws', () => {
    const rng = mulberry32(7);
    const xs = Array.from({ length: 20000 }, () => levelGuess(1, rng, shape));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
    expect(Math.abs(mean - 100 / 3)).toBeLessThan(0.2);
    expect(Math.abs(Math.sqrt(variance) - 5)).toBeLessThan(0.2);
  });
});

describe('levelOf', () => {
  it.each([
    [100, 0],
    [50, 0],
    [45, 0],
    [33, 1],
    [25, 2],
    [19, 2],
    [15, 3],
    [10, 4],
    [0, 4],
  ])('maps the guess %d to level %d', (guess, level) => {
    expect(levelOf(guess)).toBe(level);
  });

  it('maps the exact centre 50 p^k back to k for k = 0 to 4', () => {
    for (let k = 0; k <= 4; k++) {
      expect(levelOf(50 * (2 / 3) ** k)).toBe(k);
    }
  });
});

describe('defaultBeautyConfig', () => {
  it('uses the spec defaults, with the seed given', () => {
    expect(defaultBeautyConfig('s')).toEqual({
      simulated: 12,
      p: 2 / 3,
      mix: { L0: 0.3, L1: 0.4, L2: 0.2, L3: 0.1 },
      sigma: 5,
      seed: 's',
    });
  });
});

describe('runBeautyContest', () => {
  const config = defaultBeautyConfig('contest-A');

  it('returns one guess per simulated player, each in [0, 100]', () => {
    const result = runBeautyContest(config, 30);
    expect(result.guesses).toHaveLength(config.simulated);
    for (const g of result.guesses) {
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for a seed and changes with the seed', () => {
    expect(runBeautyContest(config, 30)).toEqual(runBeautyContest(config, 30));
    const other = runBeautyContest(defaultBeautyConfig('contest-B'), 30);
    expect(other.guesses).not.toEqual(runBeautyContest(config, 30).guesses);
  });

  it('counts the simulated players by level, and none at L4+', () => {
    const { levelCounts } = runBeautyContest(config, 30);
    const total = Object.values(levelCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(config.simulated);
    expect(levelCounts['L4+']).toBe(0);
  });

  it('takes the mean over the simulated players and the human, and the target as p times the mean', () => {
    const result = runBeautyContest(config, 30);
    const sum = result.guesses.reduce((a, b) => a + b, 0);
    const mean = (sum + 30) / (config.simulated + 1);
    expect(result.mean).toBeCloseTo(mean, 10);
    expect(result.target).toBeCloseTo((2 / 3) * mean, 10);
  });

  it('names the winner: the guess closest to the target, with -1 for the human', () => {
    forSeeds((seed) => {
      const result = runBeautyContest(defaultBeautyConfig(`winner:${seed}`), 45);
      const dists = result.guesses.map((g) => Math.abs(g - result.target));
      const humanDist = Math.abs(result.human - result.target);
      const best = Math.min(humanDist, ...dists);
      const winnerDist = result.winnerIndex === -1 ? humanDist : dists[result.winnerIndex];
      expect(winnerDist).toBe(best);
      if (result.winnerIndex !== -1) {
        // A tie goes to the lowest index, and the human (-1) is lowest, so the winner is strictly
        // closer than the human and every earlier simulated player.
        expect(humanDist).toBeGreaterThan(best);
        expect(dists.slice(0, result.winnerIndex).every((d) => d > best)).toBe(true);
      }
    }, 100);
  });

  it('gives the human the win when there are no simulated players', () => {
    const result = runBeautyContest({ ...config, simulated: 0 }, 30);
    expect(result.guesses).toEqual([]);
    expect(result.mean).toBe(30);
    expect(result.winnerIndex).toBe(-1);
  });

  it('labels the human level with levelOf, and level 4 as L4+', () => {
    expect(runBeautyContest(config, 0).humanLevel).toBe('L4+');
    expect(runBeautyContest(config, 50).humanLevel).toBe('L0');
    expect(runBeautyContest(config, 33).humanLevel).toBe('L1');
  });
});

describe('seeded Monte Carlo: simulated mean (spec §4.2, §8.2)', () => {
  it('pools to a mean in [30, 40] over 500 seeded games', () => {
    let sum = 0;
    let count = 0;
    forSeeds((seed) => {
      const result = runBeautyContest(defaultBeautyConfig(`beauty-mc:${seed}`), 50);
      sum += result.guesses.reduce((a, b) => a + b, 0);
      count += result.guesses.length;
    });
    const mean = sum / count;
    expect(mean).toBeGreaterThanOrEqual(30);
    expect(mean).toBeLessThanOrEqual(40);
  });
});
