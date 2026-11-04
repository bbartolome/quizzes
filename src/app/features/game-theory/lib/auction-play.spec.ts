import { describe, expect, it } from 'vitest';
import type { AuctionSetup } from './auctions.types';
import { CURSE_EPS, runAuction, simulateAuctions } from './auctions';
import { drawValues, otherPolicy, resolveWithBid, summarize } from './auction-play';
import { mulberry32 } from './rng';

// The auction page (spec §8.3): the player is bidder 0 and chooses a bid, and the other bidders
// follow a fixed policy. These pin the draws, the policy and the settlement.

const PRIVATE_FIRST: AuctionSetup = { format: 'first-price', model: 'private', bidders: 4, seed: 's' };
const PRIVATE_SECOND: AuctionSetup = { format: 'second-price', model: 'private', bidders: 4, seed: 's' };
const COMMON: AuctionSetup = { format: 'first-price', model: 'common', bidders: 4, seed: 's' };

describe('drawValues (spec §8.3 draw order)', () => {
  it('draws integer private values in 0 to 100, one for each bidder', () => {
    const { valueOrTruth, own } = drawValues(PRIVATE_FIRST, mulberry32(3));

    expect(valueOrTruth).toHaveLength(4);
    for (const v of valueOrTruth) {
      expect(Number.isInteger(v) && v >= 0 && v <= 100).toBe(true);
    }
    expect(own).toEqual(valueOrTruth);
  });

  it('gives the common model one true value shared by all, and signals within the curse band of it', () => {
    const { valueOrTruth, own } = drawValues(COMMON, mulberry32(4));

    expect(new Set(valueOrTruth).size).toBe(1);
    const truth = valueOrTruth[0];
    for (const s of own) {
      expect(Math.abs(s - truth)).toBeLessThanOrEqual(CURSE_EPS);
    }
  });

  it('keeps supplied values, so a page can fix the player\'s own value', () => {
    const fixed = drawValues({ ...PRIVATE_FIRST, values: [40, 0, 0, 0] }, mulberry32(5));

    expect(fixed.valueOrTruth[0]).toBe(40);
  });
});

describe('otherPolicy (spec §8.3: what the simulated bidders do)', () => {
  it('uses the equilibrium shade for first-price private, truthful bids for second-price, and naive signals for common values', () => {
    expect(otherPolicy(PRIVATE_FIRST)).toBe('equilibrium-shade');
    expect(otherPolicy(PRIVATE_SECOND)).toBe('truthful');
    expect(otherPolicy(COMMON)).toBe('naive-signal');
  });
});

describe('resolveWithBid', () => {
  it('uses the player\'s bid as bidder 0\'s bid, whatever the others do', () => {
    const drawn = drawValues(PRIVATE_FIRST, mulberry32(6));
    const outcome = resolveWithBid(PRIVATE_FIRST, drawn, 77, mulberry32(7));

    expect(outcome.bids[0]).toBe(77);
    expect(outcome.bids).toHaveLength(4);
  });

  it('charges a first-price winner its own bid, and a second-price winner the best other bid', () => {
    const drawn = { valueOrTruth: [60, 50, 30, 10], own: [60, 50, 30, 10] };
    const first = resolveWithBid(PRIVATE_FIRST, drawn, 90, mulberry32(8));
    expect(first.winner).toBe(0);
    expect(first.price).toBe(90);
    expect(first.payoffs[0]).toBe(60 - 90);

    const second = resolveWithBid(PRIVATE_SECOND, drawn, 90, mulberry32(8));
    expect(second.winner).toBe(0);
    expect(second.price).toBe(Math.max(...second.bids.slice(1)));
    expect(second.payoffs[0]).toBe(60 - second.price);
  });

  it('pays the player nothing and charges nothing when the player loses', () => {
    const drawn = { valueOrTruth: [60, 50, 30, 10], own: [60, 50, 30, 10] };
    const outcome = resolveWithBid(PRIVATE_FIRST, drawn, 0, mulberry32(9));

    expect(outcome.winner).not.toBe(0);
    expect(outcome.payoffs[0]).toBe(0);
  });
});

describe('summarize', () => {
  it('reports the player\'s wins, mean profit and wins below zero profit over many auctions', () => {
    const outcomes = simulateAuctions(PRIVATE_SECOND, 'truthful', 1000);
    const s = summarize(outcomes);

    expect(s.count).toBe(1000);
    expect(s.meanProfit).toBeGreaterThanOrEqual(0);
    expect(s.lossWins).toBe(0);
  });

  it('shows the winner\'s curse: naive common-value bidding loses on average with four bidders', () => {
    const outcomes = Array.from({ length: 2000 }, (_, i) =>
      runAuction({ ...COMMON, seed: `curse-${i}` }, 'naive-signal', mulberry32(i)),
    );
    const s = summarize(outcomes);

    expect(s.meanWinnerProfit).toBeLessThan(0);
  });
});
