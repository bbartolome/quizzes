import { describe, expect, it } from 'vitest';
import { forSeeds, scripted } from '../../../../testing/seeds';
import {
  bidFor,
  CURSE_MARGIN,
  equilibriumBid,
  expectedOvershoot,
  runAuction,
  settle,
  simulateAuctions,
} from './auctions';
import type { AuctionSetup, BidPolicyId } from './auctions.types';

// Auctions (spec §8.3, slice G25). The draw order is documented at the top of auctions.ts.
//
// Monte Carlo (spec §4.2, §8.3). Every statistic is a mean over 2000 auctions from one seed.
//   - Overshoot: mean(price − V) under naive first-price bidding, for V in {50, 100, 150} and
//     n in {4, 8}. The expected value is ε(n−1)/(n+1), namely 12.00 for n = 4 and 15.56 for
//     n = 8. The standard errors are about 0.15 and 0.09. Tolerance: ±0.75.
//   - Naive winner payoff: mean(value − price) of the winner, for n in 4..8. The expected value
//     is −ε(n−1)/(n+1). Tolerance: ±1.0. Sign: strictly negative, so a loss on average.
//   - Curse-aware winner payoff: the expected value is CURSE_MARGIN = 2. Tolerance: ±0.75.
//     Sign: strictly positive, so no loss on average.
//   - Seeds: `curse:<n>` per bidder count, and `overshoot:<n>:<V>` for the overshoot checks.
//   - Property sweep: forSeeds() gives seeds 0..499, with three auctions each over every
//     format, model and policy combination. It checks the settlement invariants.

const CURSE_AUCTIONS = 2000;

/** The winner's payoff, averaged over a list of outcomes. */
function meanWinnerPayoff(outcomes: { winner: number; payoffs: number[] }[]): number {
  return outcomes.reduce((sum, o) => sum + o.payoffs[o.winner], 0) / outcomes.length;
}

describe('first-price, private values', () => {
  it('bids v (n - 1) / n in equilibrium', () => {
    expect(equilibriumBid(60, 3)).toBe(40);
    expect(equilibriumBid(100, 8)).toBe(87.5);
  });

  it('is the grid argmax of (v - b) (b n / ((n - 1) 100))^(n - 1), for n 3..8 and several v', () => {
    // Each rival's value is U[0, 100]. A bid b beats a rival whose value is below b n / (n - 1),
    // so the win probability is clamped to [0, 1] and the expected payoff is (v - b) times that.
    // The grid is [0, v] in 20000 steps. The argmax must lie within two steps of v (n - 1) / n.
    const failures: string[] = [];
    for (let n = 3; n <= 8; n++) {
      for (const v of [10, 25, 50, 75, 100]) {
        const steps = 20000;
        const step = v / steps;
        let bestB = 0;
        let bestPayoff = -Infinity;
        for (let i = 0; i <= steps; i++) {
          const b = i * step;
          const win = Math.min(1, (b * n) / ((n - 1) * 100)) ** (n - 1);
          const payoff = (v - b) * win;
          if (payoff > bestPayoff) {
            bestPayoff = payoff;
            bestB = b;
          }
        }
        const expected = (v * (n - 1)) / n;
        if (Math.abs(bestB - expected) > 2 * step) {
          failures.push(`n=${n} v=${v} argmax=${bestB} expected=${expected}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('second-price, private values', () => {
  it('bidding your value is weakly dominant, checked by brute force over integer bids', () => {
    // Bidder 0 has value v. The other bids are [m, floor(m / 2)], so only the rival max m
    // matters. For every integer v, m and b in 0..100, bidding v must pay at least as much as
    // bidding b. The check runs for both tie-breaks, so bidder 0 wins a tie and loses a tie.
    let violations = 0;
    for (const tieU of [0, 0.999]) {
      for (let v = 0; v <= 100; v++) {
        for (let m = 0; m <= 100; m++) {
          const rivals = [m, Math.floor(m / 2)];
          const honest = settle('second-price', [v, 0, 0], [v, ...rivals], tieU).payoffs[0];
          for (let b = 0; b <= 100; b++) {
            const deviant = settle('second-price', [v, 0, 0], [b, ...rivals], tieU).payoffs[0];
            if (deviant > honest) violations++;
          }
        }
      }
    }
    expect(violations).toBe(0);
  });
});

describe("common value (the winner's curse)", () => {
  it('has overshoot ε (n - 1) / (n + 1), with ε = 20', () => {
    expect(expectedOvershoot(4)).toBe(12);
    expect(expectedOvershoot(8)).toBeCloseTo(140 / 9, 10);
  });

  it.each([4, 8])('makes the winner overshoot V by about the expected amount, n = %i', (n) => {
    for (const trueValue of [50, 100, 150]) {
      const outcomes = simulateAuctions(
        {
          format: 'first-price',
          model: 'common',
          bidders: n,
          trueValue,
          seed: `overshoot:${n}:${trueValue}`,
        },
        'naive-signal',
        2000,
      );
      const overshoot = outcomes.reduce((sum, o) => sum + o.price - trueValue, 0) / outcomes.length;
      expect(Math.abs(overshoot - expectedOvershoot(n))).toBeLessThan(0.75);
    }
  });

  it.each([4, 5, 6, 7, 8])('makes naive winners average a loss, n = %i', (n) => {
    const outcomes = simulateAuctions(
      { format: 'first-price', model: 'common', bidders: n, seed: `curse:${n}` },
      'naive-signal',
      CURSE_AUCTIONS,
    );
    const mean = meanWinnerPayoff(outcomes);
    expect(mean).toBeLessThan(0);
    expect(Math.abs(mean + expectedOvershoot(n))).toBeLessThan(1);
  });

  it.each([4, 5, 6, 7, 8])('does not make curse-aware winners average a loss, n = %i', (n) => {
    const outcomes = simulateAuctions(
      { format: 'first-price', model: 'common', bidders: n, seed: `curse:${n}` },
      'curse-aware',
      CURSE_AUCTIONS,
    );
    const mean = meanWinnerPayoff(outcomes);
    expect(mean).toBeGreaterThan(0);
    expect(Math.abs(mean - CURSE_MARGIN)).toBeLessThan(0.75);
  });
});

describe('bid policies', () => {
  const privateFp = {
    format: 'first-price',
    model: 'private',
    bidders: 3,
    own: 60,
    noise: 5,
  } as const;
  const privateSp = { ...privateFp, format: 'second-price' } as const;
  const commonFp = {
    format: 'first-price',
    model: 'common',
    bidders: 4,
    own: 100,
    noise: 5,
  } as const;

  it('bids as each policy says in private values, first price', () => {
    expect(bidFor('truthful', privateFp, scripted())).toBe(60);
    expect(bidFor('naive-signal', privateFp, scripted())).toBe(60);
    expect(bidFor('equilibrium-shade', privateFp, scripted())).toBe(40);
  });

  it('makes equilibrium-shade truthful in second-price private values', () => {
    expect(bidFor('equilibrium-shade', privateSp, scripted())).toBe(60);
  });

  it('adds uniform noise of amplitude noise to the shaded bid for noisy-shade', () => {
    // u = 0.75 gives (2 · 0.75 - 1) · 5 = 2.5.
    expect(bidFor('noisy-shade', privateFp, scripted(0.75))).toBeCloseTo(42.5, 10);
  });

  it('floors a noisy bid at 0', () => {
    const low = { ...privateFp, own: 2 };
    // u = 0 gives noise -5, so 4/3 - 5 is below 0.
    expect(bidFor('noisy-shade', low, scripted(0))).toBe(0);
  });

  it('bids the signal less the curse adjustment and the margin in common values', () => {
    // ε (n - 1) / (n + 1) = 12 for n = 4, and the margin is CURSE_MARGIN = 2.
    expect(bidFor('truthful', commonFp, scripted())).toBe(100);
    expect(bidFor('naive-signal', commonFp, scripted())).toBe(100);
    expect(bidFor('curse-aware', commonFp, scripted())).toBe(100 - 12 - CURSE_MARGIN);
    expect(bidFor('noisy-shade', commonFp, scripted(0.5))).toBe(100 - 12 - CURSE_MARGIN);
  });

  it('refuses equilibrium-shade in common values and curse-aware in private values', () => {
    expect(() => bidFor('equilibrium-shade', commonFp, scripted())).toThrow();
    expect(() => bidFor('curse-aware', privateFp, scripted())).toThrow();
  });

  it('draws only for noisy-shade', () => {
    const rng = scripted(0.5);
    bidFor('truthful', privateFp, rng);
    bidFor('equilibrium-shade', privateFp, rng);
    expect(rng()).toBe(0.5);
  });
});

describe('settle', () => {
  const values = [60, 70, 80];

  it('charges the winner its own bid in first price', () => {
    const outcome = settle('first-price', values, [30, 50, 40], 0);
    expect(outcome).toEqual({
      bids: [30, 50, 40],
      winner: 1,
      price: 50,
      payoffs: [0, 20, 0],
      valueOrTruth: values,
    });
  });

  it('charges the winner the highest rival bid in second price', () => {
    const outcome = settle('second-price', values, [30, 50, 40], 0);
    expect(outcome.winner).toBe(1);
    expect(outcome.price).toBe(40);
    expect(outcome.payoffs).toEqual([0, 30, 0]);
  });

  it('breaks a tie at the top with the tie draw', () => {
    expect(settle('first-price', [0, 0, 0], [50, 50, 20], 0).winner).toBe(0);
    expect(settle('first-price', [0, 0, 0], [50, 50, 20], 0.999).winner).toBe(1);
  });
});

describe('runAuction', () => {
  it('draws private values as floor(101 u), then the tie draw', () => {
    const outcome = runAuction(
      { format: 'first-price', model: 'private', bidders: 3, seed: 'x' },
      'truthful',
      scripted(0.5, 0.25, 0.75, 0),
    );
    expect(outcome.valueOrTruth).toEqual([50, 25, 75]);
    expect(outcome.bids).toEqual([50, 25, 75]);
    expect(outcome.winner).toBe(2);
    expect(outcome.price).toBe(75);
    expect(outcome.payoffs).toEqual([0, 0, 0]);
  });

  it('draws V as 50 + 100 u, then one signal noise per bidder, then the tie draw', () => {
    // V = 100. Noise (2u - 1) · 20 gives signals 110, 90 and 100.
    const outcome = runAuction(
      { format: 'first-price', model: 'common', bidders: 3, seed: 'x' },
      'naive-signal',
      scripted(0.5, 0.75, 0.25, 0.5, 0),
    );
    expect(outcome.valueOrTruth).toEqual([100, 100, 100]);
    expect(outcome.bids).toEqual([110, 90, 100]);
    expect(outcome.winner).toBe(0);
    expect(outcome.price).toBe(110);
    expect(outcome.payoffs[0]).toBeCloseTo(-10, 10);
  });

  it('draws nothing for values that the setup gives', () => {
    const setup: AuctionSetup = {
      format: 'second-price',
      model: 'private',
      bidders: 3,
      values: [10, 20, 30],
      seed: 'x',
    };
    // Only the tie draw is scripted, so any value draw would throw.
    const outcome = runAuction(setup, 'truthful', scripted(0));
    expect(outcome.winner).toBe(2);
    expect(outcome.price).toBe(20);
    expect(outcome.payoffs[2]).toBe(10);
  });

  it('draws one bid noise per bidder, in bidder order, before the tie draw', () => {
    const setup: AuctionSetup = {
      format: 'first-price',
      model: 'private',
      bidders: 3,
      values: [60, 30, 30],
      seed: 'x',
    };
    // Bidder 0 gets noise 0.75 → +2.5, so 40 + 2.5 = 42.5. Bidders 1 and 2 get noise 0.5 → 0.
    const outcome = runAuction(setup, 'noisy-shade', scripted(0.75, 0.5, 0.5, 0));
    expect(outcome.bids).toEqual([42.5, 20, 20]);
    expect(outcome.winner).toBe(0);
    expect(outcome.payoffs[0]).toBeCloseTo(17.5, 10);
  });
});

describe('simulateAuctions', () => {
  const setup: AuctionSetup = {
    format: 'second-price',
    model: 'private',
    bidders: 4,
    seed: 'sim',
  };

  it('is deterministic for a seed, and changes with the seed', () => {
    expect(simulateAuctions(setup, 'truthful', 5)).toEqual(simulateAuctions(setup, 'truthful', 5));
    const other = simulateAuctions({ ...setup, seed: 'other' }, 'truthful', 5);
    expect(other).not.toEqual(simulateAuctions(setup, 'truthful', 5));
  });

  it('returns the number of auctions asked for, each with one entry per bidder', () => {
    const outcomes = simulateAuctions(setup, 'truthful', 7);
    expect(outcomes).toHaveLength(7);
    for (const o of outcomes) {
      expect(o.bids).toHaveLength(4);
      expect(o.payoffs).toHaveLength(4);
      expect(o.valueOrTruth).toHaveLength(4);
    }
  });
});

describe('settlement invariants over seeds 0..499', () => {
  const POLICIES: Record<'private' | 'common', BidPolicyId[]> = {
    private: ['truthful', 'equilibrium-shade', 'noisy-shade'],
    common: ['truthful', 'naive-signal', 'curse-aware', 'noisy-shade'],
  };

  it('keeps every outcome consistent with its format', () => {
    const broken: string[] = [];
    forSeeds((seed) => {
      for (const format of ['first-price', 'second-price'] as const) {
        for (const model of ['private', 'common'] as const) {
          for (const policy of POLICIES[model]) {
            const outcomes = simulateAuctions(
              { format, model, bidders: 3 + (seed % 6), seed: `prop:${seed}` },
              policy,
              3,
            );
            for (const o of outcomes) {
              const top = Math.max(...o.bids);
              const others = o.bids.filter((_, i) => i !== o.winner);
              const label = `${seed} ${format} ${model} ${policy}`;
              if (o.bids[o.winner] !== top) broken.push(`${label}: winner not top`);
              const expectedPrice =
                format === 'first-price' ? o.bids[o.winner] : Math.max(...others);
              if (o.price !== expectedPrice) broken.push(`${label}: price`);
              if (o.payoffs[o.winner] !== o.valueOrTruth[o.winner] - o.price) {
                broken.push(`${label}: winner payoff`);
              }
              if (o.payoffs.some((p, i) => i !== o.winner && p !== 0)) {
                broken.push(`${label}: loser payoff`);
              }
            }
          }
        }
      }
    });
    expect(broken).toEqual([]);
  });
});
