// Type-only. Copied verbatim from docs/specs/game-theory.md §8.3.
// Bid policies and the auction engine are implemented by G25.

export type AuctionFormat = 'first-price' | 'second-price';
export type ValueModel = 'private' | 'common';
export interface AuctionSetup {
  format: AuctionFormat;
  model: ValueModel;
  bidders: number; // 3..8
  values?: number[]; // private: iid integer U[0, 100]
  trueValue?: number; // common: V in [50, 150]
  signals?: number[]; // common: s_i = V + U[-eps, eps], eps = 20
  noise?: number;
  seed: string;
}
export type BidPolicyId =
  'truthful' | 'equilibrium-shade' | 'naive-signal' | 'curse-aware' | 'noisy-shade';
export interface AuctionOutcome {
  bids: number[];
  winner: number;
  price: number;
  payoffs: number[];
  valueOrTruth: number[];
}
