import type {
  AuctionFormat,
  AuctionOutcome,
  AuctionSetup,
  BidPolicyId,
  ValueModel,
} from './auctions.types';
import { hashSeed, mulberry32 } from './rng';
import type { Rng } from './rng.types';

// Auctions engine (spec §8.3). Pure: no Angular, no clock, no Math.random.
//
// Draw order. runAuction(setup, policy, rng) draws in this order:
//   1. Values.
//      private: unless setup.values is given, n draws, v_i = floor(101 · u_i), integers 0..100.
//      common:   unless setup.trueValue is given, 1 draw, V = 50 + 100 · u.
//                unless setup.signals is given, n draws, s_i = V + (2u_i - 1) · ε, with ε = 20.
//                A supplied list replaces its draws, so the count depends only on what is supplied.
//   2. Bids, one bidder at a time in index order. Only noisy-shade draws, one per bidder.
//   3. Settlement: 1 draw, the tie-break u. Among the bidders tied at the top bid, the winner is
//      ties[floor(u · ties.length)].
// simulateAuctions(setup, policy, count) runs runAuction count times on one stream,
// mulberry32(hashSeed(setup.seed)).
//
// Policies. Each bid uses only the bidder's own information: its value (private) or its signal
// (common). Cases marked "throws" are not defined for that model.
//   private, own = v:  truthful and naive-signal bid v.
//                      equilibrium-shade bids v (n - 1) / n first price, or v second price.
//   common, own = s:   truthful and naive-signal bid s.
//                      curse-aware bids s - ε (n - 1) / (n + 1) - CURSE_MARGIN.
//   noisy-shade:       the model's shaded bid (equilibrium-shade in private, curse-aware in common)
//                      plus (2u - 1) · noise, floored at 0.
// truthful and naive-signal are kept as separate names because the spec lists both.

/** The noise half-width ε in the common-value signals s_i = V + U[-ε, ε]. */
export const CURSE_EPS = 20;

/** The safety margin that curse-aware bidders subtract. */
export const CURSE_MARGIN = 2;

/** The default noise amplitude for noisy-shade, when the setup gives none. */
export const DEFAULT_NOISE = 5;

export interface BidContext {
  format: AuctionFormat;
  model: ValueModel;
  bidders: number;
  /** The bidder's value (private) or signal (common). */
  own: number;
  noise: number;
}

/** The symmetric first-price equilibrium bid b(v) = v (n - 1) / n, for iid U[0, 100] values. */
export function equilibriumBid(value: number, bidders: number): number {
  return (value * (bidders - 1)) / bidders;
}

/** The winner's expected overshoot in common values: ε (n - 1) / (n + 1). */
export function expectedOvershoot(bidders: number, eps = CURSE_EPS): number {
  return (eps * (bidders - 1)) / (bidders + 1);
}

/** One bidder's bid under a policy. Only noisy-shade draws from rng. */
export function bidFor(policy: BidPolicyId, ctx: BidContext, rng: Rng): number {
  switch (policy) {
    case 'truthful':
    case 'naive-signal':
      return ctx.own;
    case 'equilibrium-shade':
      if (ctx.model !== 'private') {
        throw new Error('equilibrium-shade is defined for private values');
      }
      return ctx.format === 'second-price' ? ctx.own : equilibriumBid(ctx.own, ctx.bidders);
    case 'curse-aware':
      if (ctx.model !== 'common') {
        throw new Error('curse-aware is defined for common values');
      }
      return ctx.own - expectedOvershoot(ctx.bidders) - CURSE_MARGIN;
    case 'noisy-shade': {
      const shaded = bidFor(
        ctx.model === 'private' ? 'equilibrium-shade' : 'curse-aware',
        ctx,
        rng,
      );
      return Math.max(0, shaded + (2 * rng() - 1) * ctx.noise);
    }
  }
}

/**
 * Settles an auction from explicit bids. The highest bid wins, and tieU picks among the tied
 * top bidders. First price charges the winner its own bid. Second price charges the highest
 * other bid.
 */
export function settle(
  format: AuctionFormat,
  valueOrTruth: number[],
  bids: number[],
  tieU: number,
): AuctionOutcome {
  const top = Math.max(...bids);
  const ties = bids.flatMap((bid, i) => (bid === top ? [i] : []));
  const winner = ties[Math.floor(tieU * ties.length)];
  const price =
    format === 'first-price' ? bids[winner] : Math.max(...bids.filter((_, i) => i !== winner));
  const payoffs = bids.map((_, i) => (i === winner ? valueOrTruth[i] - price : 0));
  return { bids, winner, price, payoffs, valueOrTruth };
}

/** One auction, drawing values, signals, noise and the tie-break from rng. */
export function runAuction(setup: AuctionSetup, policy: BidPolicyId, rng: Rng): AuctionOutcome {
  const n = setup.bidders;
  if (!Number.isInteger(n) || n < 2) {
    throw new Error('an auction needs at least two bidders');
  }
  const noise = setup.noise ?? DEFAULT_NOISE;

  let valueOrTruth: number[];
  let own: number[];
  if (setup.model === 'private') {
    valueOrTruth = setup.values ?? Array.from({ length: n }, () => Math.floor(101 * rng()));
    own = valueOrTruth;
  } else {
    const trueValue = setup.trueValue ?? 50 + 100 * rng();
    own = setup.signals ?? Array.from({ length: n }, () => trueValue + (2 * rng() - 1) * CURSE_EPS);
    valueOrTruth = Array.from({ length: n }, () => trueValue);
  }

  const bids = own.map((info) =>
    bidFor(policy, { format: setup.format, model: setup.model, bidders: n, own: info, noise }, rng),
  );
  return settle(setup.format, valueOrTruth, bids, rng());
}

/** `count` auctions on one stream, mulberry32(hashSeed(setup.seed)). */
export function simulateAuctions(
  setup: AuctionSetup,
  policy: BidPolicyId,
  count: number,
): AuctionOutcome[] {
  const rng = mulberry32(hashSeed(setup.seed));
  return Array.from({ length: count }, () => runAuction(setup, policy, rng));
}
