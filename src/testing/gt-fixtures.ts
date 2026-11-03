import type { GameClass, PayoffMatrix } from '../app/features/game-theory/lib/matrix.types';

/**
 * The five canonical 2x2 classification games (spec §5.1 table), as payoff matrices.
 * Rows are [Cooperate, Defect] for the row player; columns are the same for the column player.
 * Each row is a matrix [r][c] for one player, so the two arrays are the two players' payoffs.
 */
export const CANONICAL_GAMES: Record<Exclude<GameClass, 'other'>, PayoffMatrix> = {
  // T4 R3 P1 S0
  'prisoners-dilemma': {
    rows: 2,
    cols: 2,
    row: [
      [3, 0],
      [4, 1],
    ],
    col: [
      [3, 4],
      [0, 1],
    ],
  },
  // R4 T3 P2 S1
  'stag-hunt': {
    rows: 2,
    cols: 2,
    row: [
      [4, 1],
      [3, 2],
    ],
    col: [
      [4, 3],
      [1, 2],
    ],
  },
  // T4 R3 S2 P1
  'chicken-game': {
    rows: 2,
    cols: 2,
    row: [
      [3, 2],
      [4, 1],
    ],
    col: [
      [3, 4],
      [2, 1],
    ],
  },
  // (2,1) and (1,2) on the diagonal, (0,0) off it
  'battle-of-the-sexes': {
    rows: 2,
    cols: 2,
    row: [
      [2, 0],
      [0, 1],
    ],
    col: [
      [1, 0],
      [0, 2],
    ],
  },
  // (1,1) on the diagonal, (0,0) off it
  'coordination-game': {
    rows: 2,
    cols: 2,
    row: [
      [1, 0],
      [0, 1],
    ],
    col: [
      [1, 0],
      [0, 1],
    ],
  },
};

function transpose(m: number[][]): number[][] {
  return m[0].map((_, c) => m.map((row) => row[c]));
}

function flipRows(m: number[][]): number[][] {
  return [...m].reverse().map((row) => [...row]);
}

function flipCols(m: number[][]): number[][] {
  return m.map((row) => [...row].reverse());
}

/**
 * The 8 relabellings of a game: swap players, swap rows, swap columns, in every combination.
 * A class is invariant under all of them (spec §4.2), so a classifier must return the same class for each.
 */
export function eightSymmetries(m: PayoffMatrix): PayoffMatrix[] {
  const variants: PayoffMatrix[] = [];
  for (const swapPlayers of [false, true]) {
    for (const flipR of [false, true]) {
      for (const flipC of [false, true]) {
        const base: PayoffMatrix = swapPlayers
          ? { rows: m.cols, cols: m.rows, row: transpose(m.col), col: transpose(m.row) }
          : m;
        const withRows = flipR
          ? { ...base, row: flipRows(base.row), col: flipRows(base.col) }
          : base;
        variants.push(
          flipC
            ? { ...withRows, row: flipCols(withRows.row), col: flipCols(withRows.col) }
            : withRows,
        );
      }
    }
  }
  return variants;
}
