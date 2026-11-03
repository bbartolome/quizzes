// Type-only. Copied verbatim from docs/specs/game-theory.md §8.1.
// Functions (stepTurn, playMatch, roundRobin, replicatorStep) are implemented by G19 and G23.

import type { Rng } from './rng.types';

export type Move = 'C' | 'D';
export type BotId =
  | 'copycat'
  | 'always-cooperate'
  | 'always-cheat'
  | 'grudger'
  | 'detective'
  | 'copykitten'
  | 'simpleton'
  | 'random';
export interface StrategyContext {
  turn: number;
  mine: readonly Move[];
  theirs: readonly Move[]; // the opponent's PLAYED moves, after noise
  rng: Rng;
}
export interface Bot {
  id: BotId;
  name: string;
  blurb: string;
  tell: string; // the observable giveaway, shown after a reveal
  conceptIds: string[];
  confusableWith: BotId[];
  decide(ctx: StrategyContext): Move; // stateless, derived from the full history
}
export interface PdPayoffs {
  T: number;
  R: number;
  P: number;
  S: number;
} // default 5/3/1/0; T>R>P>S and 2R>T+S asserted
export type Horizon =
  { kind: 'fixed'; turns: number } | { kind: 'continue'; p: number; cap: number };
export interface MatchConfig {
  a: BotId | 'human';
  b: BotId;
  horizon: Horizon;
  noise: number; // 0..0.1, flips PLAYED moves
  payoffs: PdPayoffs;
  seed: string;
}
export interface TurnRecord {
  index: number;
  intendedA: Move;
  intendedB: Move;
  playedA: Move;
  playedB: Move;
  payoffA: number;
  payoffB: number;
}
export interface MatchResult {
  config: MatchConfig;
  turns: TurnRecord[];
  totalA: number;
  totalB: number;
  mutualCooperation: number;
}
export interface TournamentResult {
  population: BotId[];
  noise: number;
  reps: number;
  meanPerTurn: Record<BotId, number>;
  ranking: BotId[];
}
