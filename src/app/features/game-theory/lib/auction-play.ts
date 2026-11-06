import { CURSE_EPS, DEFAULT_NOISE, TRUE_VALUE_RANGE, bidFor, settle } from './auctions';
import type { AuctionOutcome, AuctionSetup, BidPolicyId } from './auctions.types';
import type { Rng } from './rng';

// The auction page (spec §8.3). The player is bidder 0 and picks a bid. The other bidders follow a
// fixed policy for the format. Draws follow runAuction's order, so a page and simulateAuctions agree.

/** The values (private) or the true value and signals (common), before any bid. */
export interface DrawnAuction {
  valueOrTruth: number[];
  own: number[];
}

/** Draws values or signals as runAuction does: private values first, or the true value then signals. */
export function drawValues(setup: AuctionSetup, rng: Rng): DrawnAuction {
  const n = setup.bidders;
  if (setup.model === 'private') {
    const values = setup.values ?? Array.from({ length: n }, () => Math.floor(101 * rng()));
    return { valueOrTruth: values, own: values };
  }
  const trueValue =
    setup.trueValue ?? TRUE_VALUE_RANGE.min + (TRUE_VALUE_RANGE.max - TRUE_VALUE_RANGE.min) * rng();
  const own =
    setup.signals ?? Array.from({ length: n }, () => trueValue + (2 * rng() - 1) * CURSE_EPS);
  return { valueOrTruth: Array.from({ length: n }, () => trueValue), own };
}

/** What the simulated bidders do: equilibrium shade, truthful, or naive signal bids (spec §8.3). */
export function otherPolicy(setup: AuctionSetup): BidPolicyId {
  if (setup.model === 'common') return 'naive-signal';
  return setup.format === 'first-price' ? 'equilibrium-shade' : 'truthful';
}

/** Settles one auction with the player's bid for bidder 0. The tie-break is the last draw. */
export function resolveWithBid(
  setup: AuctionSetup,
  drawn: DrawnAuction,
  humanBid: number,
  rng: Rng,
): AuctionOutcome {
  const n = setup.bidders;
  const policy = otherPolicy(setup);
  const bids = drawn.own.map((own, i) =>
    i === 0
      ? humanBid
      : bidFor(
          policy,
          { format: setup.format, model: setup.model, bidders: n, own, noise: DEFAULT_NOISE },
          rng,
        ),
  );
  return settle(setup.format, drawn.valueOrTruth, bids, rng());
}

export interface AuctionSummary {
  count: number;
  /** The player's mean profit, bidder 0 across the auctions. */
  meanProfit: number;
  /** Auctions the player won at a loss. */
  lossWins: number;
  /** The mean profit of whoever won, across all auctions. The winner's curse shows here. */
  meanWinnerProfit: number;
}

/** Summarises many auctions for the "simulate" panel (spec §8.3). */
export function summarize(outcomes: readonly AuctionOutcome[]): AuctionSummary {
  const count = outcomes.length;
  const mean = (xs: readonly number[]) =>
    xs.length === 0 ? 0 : xs.reduce((sum, x) => sum + x, 0) / xs.length;
  return {
    count,
    meanProfit: mean(outcomes.map((o) => o.payoffs[0])),
    lossWins: outcomes.filter((o) => o.winner === 0 && o.payoffs[0] < 0).length,
    meanWinnerProfit: mean(outcomes.map((o) => o.payoffs[o.winner])),
  };
}
