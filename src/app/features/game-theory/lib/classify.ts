import type { GameClass, PayoffMatrix } from './matrix.types';

type Canonical = Exclude<GameClass, 'other'>;

/** A symmetric 2x2 game from R, S, T and P, laid out as in spec §5.1: row[r][c], col[r][c]. */
function symmetricGame(R: number, S: number, T: number, P: number): PayoffMatrix {
  return {
    rows: 2,
    cols: 2,
    row: [
      [R, S],
      [T, P],
    ],
    col: [
      [R, T],
      [S, P],
    ],
  };
}

/** The five canonical 2x2 games (spec §5.1). A game is classified by comparing it to these. */
export const CLASS_TEMPLATES: Readonly<Record<Canonical, PayoffMatrix>> = {
  'prisoners-dilemma': symmetricGame(3, 0, 4, 1), // T4 R3 P1 S0
  'stag-hunt': symmetricGame(4, 1, 3, 2), // R4 T3 P2 S1
  'chicken-game': symmetricGame(3, 2, 4, 1), // T4 R3 S2 P1
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

type Grid = number[][];

function transpose(g: Grid): Grid {
  return g[0].map((_, c) => g.map((line) => line[c]));
}

/** The dense ranks of four payoffs, with ties sharing a rank: [3, 0, 3, 1] becomes [2, 0, 2, 1]. */
function denseRanks(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  return values.map((value) => sorted.indexOf(value));
}

/** The 8-value rank tuple of a 2x2 game after one relabelling: the row player's ranks, then the column player's. */
function tupleUnder(
  m: PayoffMatrix,
  swapPlayers: boolean,
  flipRows: boolean,
  flipCols: boolean,
): number[] {
  let row: Grid = swapPlayers ? transpose(m.col) : m.row;
  let col: Grid = swapPlayers ? transpose(m.row) : m.col;
  if (flipRows) {
    row = [...row].reverse();
    col = [...col].reverse();
  }
  if (flipCols) {
    row = row.map((line) => [...line].reverse());
    col = col.map((line) => [...line].reverse());
  }
  return [...denseRanks(row.flat()), ...denseRanks(col.flat())];
}

function compareTuples(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

/**
 * The lexicographically smallest rank tuple over the 8 relabellings (swap players, swap rows,
 * swap columns, in every combination). Every relabelling of a game gives the same signature.
 */
export function canonicalSignature(m: PayoffMatrix): number[] {
  const tuples: number[][] = [];
  for (const swapPlayers of [false, true]) {
    for (const flipRows of [false, true]) {
      for (const flipCols of [false, true]) {
        tuples.push(tupleUnder(m, swapPlayers, flipRows, flipCols));
      }
    }
  }
  return tuples.reduce((best, tuple) => (compareTuples(tuple, best) < 0 ? tuple : best));
}

const keyOf = (signature: number[]) => signature.join(',');

const CLASS_BY_SIGNATURE = new Map<string, Canonical>(
  (Object.keys(CLASS_TEMPLATES) as Canonical[]).map((cls): [string, Canonical] => [
    keyOf(canonicalSignature(CLASS_TEMPLATES[cls])),
    cls,
  ]),
);

/** The canonical class of a 2x2 game, or 'other' when it matches none of the five templates. */
export function classify2x2(m: PayoffMatrix): GameClass {
  if (m.rows !== 2 || m.cols !== 2) {
    return 'other';
  }
  return CLASS_BY_SIGNATURE.get(keyOf(canonicalSignature(m))) ?? 'other';
}
