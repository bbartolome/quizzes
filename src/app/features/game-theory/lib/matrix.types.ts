// Type-only. Copied verbatim from docs/specs/game-theory.md §5.1.
// Functions (bestResponses, pureNash, classify2x2, ...) are implemented by the solver lane (G3-G6).

export type Player = 'row' | 'col';
export interface CellRef {
  r: number;
  c: number;
}
export interface PayoffMatrix {
  rows: number;
  cols: number; // integer payoffs
  row: number[][]; // row[r][c] = the row player's payoff
  col: number[][]; // col[r][c] = the column player's payoff
}
export interface MatrixGame {
  rowLabels: string[];
  colLabels: string[];
  payoffs: PayoffMatrix;
  story?: string; // cover story, varied for transfer
}
// GameClass ids equal concept ids, so a correct classification credits that concept.
export type GameClass =
  | 'prisoners-dilemma'
  | 'stag-hunt'
  | 'chicken-game'
  | 'battle-of-the-sexes'
  | 'coordination-game'
  | 'other';
export interface Fraction {
  num: number;
  den: number;
} // reduced, den > 0
export interface MixedNash2x2 {
  p: Fraction; // P(row plays row 0)
  q: Fraction; // P(column plays column 0)
  rowValue: Fraction;
  colValue: Fraction;
}
export interface EliminationStep {
  player: Player;
  eliminated: number;
  dominatedBy: number;
  remainingRows: number[];
  remainingCols: number[];
}
