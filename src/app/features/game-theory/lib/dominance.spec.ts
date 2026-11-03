import { describe, expect, it } from 'vitest';
import { CANONICAL_GAMES } from '../../../../testing/gt-fixtures';
import { forSeeds } from '../../../../testing/seeds';
import { eliminationTrace, strictlyDominates } from './dominance';
import type { PayoffMatrix, Player } from './matrix.types';

// Same algorithm as mulberry32 (spec §4.1). rng.ts lands in G2, so this spec carries its own copy.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic integer game. Payoffs fall in 0..max, so ties are common. */
function randomGame(seed: number, rows: number, cols: number, max: number): PayoffMatrix {
  const draw = prng(seed);
  const grid = () =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(draw() * (max + 1))),
    );
  return { rows, cols, row: grid(), col: grid() };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The game restricted to the remaining strategies, renumbered from 0. */
function restrict(m: PayoffMatrix, rows: number[], cols: number[]): PayoffMatrix {
  return {
    rows: rows.length,
    cols: cols.length,
    row: rows.map((r) => cols.map((c) => m.row[r][c])),
    col: rows.map((r) => cols.map((c) => m.col[r][c])),
  };
}

interface Option {
  player: Player;
  strategy: number; // original index
}

/** Every strategy that is strictly dominated in the game that remains. */
function legalEliminations(m: PayoffMatrix, rows: number[], cols: number[]): Option[] {
  const sub = restrict(m, rows, cols);
  const options: Option[] = [];
  rows.forEach((strategy, i) => {
    if (rows.some((_, j) => strictlyDominates(sub, 'row', j, i))) {
      options.push({ player: 'row', strategy });
    }
  });
  cols.forEach((strategy, j) => {
    if (cols.some((_, k) => strictlyDominates(sub, 'col', k, j))) {
      options.push({ player: 'col', strategy });
    }
  });
  return options;
}

/** Every final state reached by every legal elimination order, as "rows|cols" keys. */
function everyFinalState(m: PayoffMatrix, rows: number[], cols: number[], out: string[]): void {
  const options = legalEliminations(m, rows, cols);
  if (options.length === 0) {
    out.push(`${rows.join(',')}|${cols.join(',')}`);
    return;
  }
  for (const { player, strategy } of options) {
    if (player === 'row') {
      everyFinalState(
        m,
        rows.filter((r) => r !== strategy),
        cols,
        out,
      );
    } else {
      everyFinalState(
        m,
        rows,
        cols.filter((c) => c !== strategy),
        out,
      );
    }
  }
}

describe('strictlyDominates', () => {
  it('finds a row strategy that strictly beats another against every column', () => {
    const pd = CANONICAL_GAMES['prisoners-dilemma'];
    expect(strictlyDominates(pd, 'row', 1, 0)).toBe(true);
    expect(strictlyDominates(pd, 'row', 0, 1)).toBe(false);
  });

  it('finds a column strategy that strictly beats another against every row', () => {
    const pd = CANONICAL_GAMES['prisoners-dilemma'];
    expect(strictlyDominates(pd, 'col', 1, 0)).toBe(true);
    expect(strictlyDominates(pd, 'col', 0, 1)).toBe(false);
  });

  it('does not count weak dominance, where one column is a tie', () => {
    const weak: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [2, 2],
        [2, 1],
      ],
      col: [
        [0, 0],
        [0, 0],
      ],
    };
    expect(strictlyDominates(weak, 'row', 0, 1)).toBe(false);
  });

  it('judges dominance against every opponent strategy, not just some of them', () => {
    const mixed: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [3, 0],
        [1, 1],
      ],
      col: [
        [0, 0],
        [0, 0],
      ],
    };
    expect(strictlyDominates(mixed, 'row', 0, 1)).toBe(false);
  });

  it('is false for a strategy against itself', () => {
    expect(strictlyDominates(CANONICAL_GAMES['prisoners-dilemma'], 'row', 1, 1)).toBe(false);
  });
});

describe('eliminationTrace', () => {
  it("removes the row player first, then the column player, in the Prisoner's Dilemma", () => {
    expect(eliminationTrace(CANONICAL_GAMES['prisoners-dilemma'])).toEqual([
      {
        player: 'row',
        eliminated: 0,
        dominatedBy: 1,
        remainingRows: [1],
        remainingCols: [0, 1],
      },
      {
        player: 'col',
        eliminated: 0,
        dominatedBy: 1,
        remainingRows: [1],
        remainingCols: [1],
      },
    ]);
  });

  it('follows a cascade: a column removal makes a row strictly dominated', () => {
    const cascade: PayoffMatrix = {
      rows: 2,
      cols: 3,
      row: [
        [2, 2, 0],
        [1, 1, 3],
      ],
      col: [
        [0, 1, 0],
        [0, 1, 0],
      ],
    };
    expect(eliminationTrace(cascade)).toEqual([
      {
        player: 'col',
        eliminated: 0,
        dominatedBy: 1,
        remainingRows: [0, 1],
        remainingCols: [1, 2],
      },
      {
        player: 'col',
        eliminated: 2,
        dominatedBy: 1,
        remainingRows: [0, 1],
        remainingCols: [1],
      },
      {
        player: 'row',
        eliminated: 1,
        dominatedBy: 0,
        remainingRows: [0],
        remainingCols: [1],
      },
    ]);
  });

  it('names the lowest-index dominator when several strategies dominate', () => {
    const game: PayoffMatrix = {
      rows: 3,
      cols: 2,
      row: [
        [1, 1],
        [5, 5],
        [3, 3],
      ],
      col: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    };
    const trace = eliminationTrace(game);
    expect(trace[0]).toEqual({
      player: 'row',
      eliminated: 0,
      dominatedBy: 1,
      remainingRows: [1, 2],
      remainingCols: [0, 1],
    });
    expect(trace[1]).toEqual({
      player: 'row',
      eliminated: 2,
      dominatedBy: 1,
      remainingRows: [1],
      remainingCols: [0, 1],
    });
  });

  it('eliminates nothing when no strategy is strictly dominated', () => {
    for (const name of [
      'stag-hunt',
      'chicken-game',
      'battle-of-the-sexes',
      'coordination-game',
    ] as const) {
      expect(eliminationTrace(CANONICAL_GAMES[name])).toEqual([]);
    }
  });

  it('does not eliminate on weak dominance alone (M14)', () => {
    const weakOnly: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [2, 2],
        [2, 1],
      ],
      col: [
        [0, 0],
        [0, 0],
      ],
    };
    expect(eliminationTrace(weakOnly)).toEqual([]);
  });

  it('ends with survivors that have no strictly dominated strategy left, on 500 seeded games', () => {
    forSeeds((seed) => {
      const game = randomGame(seed, 2 + (seed % 3), 2 + (Math.floor(seed / 3) % 3), 3);
      const trace = eliminationTrace(game);
      const last = trace.at(-1);
      const rows = last ? last.remainingRows : range(game.rows);
      const cols = last ? last.remainingCols : range(game.cols);
      expect(legalEliminations(game, rows, cols)).toEqual([]);
    });
  });

  it('reaches the same final set in every legal elimination order (order-independence)', () => {
    forSeeds((seed) => {
      const game = randomGame(seed + 500, 2 + (seed % 2), 2 + (Math.floor(seed / 2) % 3), 2);
      const trace = eliminationTrace(game);
      const last = trace.at(-1);
      const canonical = last
        ? `${last.remainingRows.join(',')}|${last.remainingCols.join(',')}`
        : `${range(game.rows).join(',')}|${range(game.cols).join(',')}`;
      const reached: string[] = [];
      everyFinalState(game, range(game.rows), range(game.cols), reached);
      expect(reached.length).toBeGreaterThan(0);
      expect(new Set(reached)).toEqual(new Set([canonical]));
    });
  });
});
