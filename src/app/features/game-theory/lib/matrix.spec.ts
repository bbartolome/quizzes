import { describe, expect, it } from 'vitest';
import { bruteForcePureNash } from '../../../../testing/brute-force-nash';
import { CANONICAL_GAMES } from '../../../../testing/gt-fixtures';
import { forSeeds } from '../../../../testing/seeds';
import { bestResponseMarks, bestResponses, paretoOptimal, pureNash } from './matrix';
import type { CellRef, GameClass, PayoffMatrix } from './matrix.types';
import { mulberry32 as prng } from './rng';

/** A deterministic integer game. Payoffs fall in 0..max, so ties are common. */
function randomGame(seed: number, rows: number, cols: number, max: number): PayoffMatrix {
  const draw = prng(seed);
  const grid = () =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(draw() * (max + 1))),
    );
  return { rows, cols, row: grid(), col: grid() };
}

/** Sizes 2x2 to 4x4, varied by seed. */
const sizeFor = (seed: number) => ({ rows: 2 + (seed % 3), cols: 2 + (Math.floor(seed / 3) % 3) });

// Row payoffs: column 0 is [2, 2, 1] (a tie for rows 0 and 1), column 1 is [0, 1, 3] (row 2 alone).
// Column payoffs: row 0 is [1, 0], row 1 is [4, 4] (a tie), row 2 is [3, 2].
const SAMPLE: PayoffMatrix = {
  rows: 3,
  cols: 2,
  row: [
    [2, 0],
    [2, 1],
    [1, 3],
  ],
  col: [
    [1, 0],
    [4, 4],
    [3, 2],
  ],
};

describe('bestResponses', () => {
  it('returns every row that maximises the row payoff against a column, so ties stay', () => {
    expect(bestResponses(SAMPLE, 'row', 0)).toEqual([0, 1]);
  });

  it('returns the single best response when it is unique', () => {
    expect(bestResponses(SAMPLE, 'row', 1)).toEqual([2]);
  });

  it('answers the column player against a row, and keeps ties there too', () => {
    expect(bestResponses(SAMPLE, 'col', 0)).toEqual([0]);
    expect(bestResponses(SAMPLE, 'col', 1)).toEqual([0, 1]);
    expect(bestResponses(SAMPLE, 'col', 2)).toEqual([0]);
  });
});

describe('bestResponseMarks', () => {
  it('marks the row player best responses per column', () => {
    expect(bestResponseMarks(SAMPLE).row).toEqual([
      [true, false],
      [true, false],
      [false, true],
    ]);
  });

  it('marks the column player best responses per row, which differ from the row marks', () => {
    expect(bestResponseMarks(SAMPLE).col).toEqual([
      [true, false],
      [true, true],
      [true, false],
    ]);
  });
});

describe('pureNash', () => {
  const expected: Record<Exclude<GameClass, 'other'>, CellRef[]> = {
    'prisoners-dilemma': [{ r: 1, c: 1 }],
    'stag-hunt': [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ],
    'chicken-game': [
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ],
    'battle-of-the-sexes': [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ],
    'coordination-game': [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ],
  };

  it.each(Object.keys(expected) as (keyof typeof expected)[])(
    'finds the pure equilibria of %s',
    (name) => {
      expect(pureNash(CANONICAL_GAMES[name])).toEqual(expected[name]);
    },
  );

  it('counts a cell as stable when a deviation only ties (weak inequality)', () => {
    const allTies: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [1, 1],
        [1, 1],
      ],
      col: [
        [1, 1],
        [1, 1],
      ],
    };
    expect(pureNash(allTies)).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 0 },
      { r: 1, c: 1 },
    ]);
  });

  it('agrees with the brute-force reference on 500 seeded games with many ties', () => {
    forSeeds((seed) => {
      const { rows, cols } = sizeFor(seed);
      const game = randomGame(seed, rows, cols, 2);
      expect(pureNash(game)).toEqual(bruteForcePureNash(game));
    });
  });

  it('agrees with the brute-force reference on 500 seeded games with wider payoffs', () => {
    forSeeds((seed) => {
      const { rows, cols } = sizeFor(seed);
      const game = randomGame(seed + 1000, rows, cols, 5);
      expect(pureNash(game)).toEqual(bruteForcePureNash(game));
    });
  });
});

describe('paretoOptimal', () => {
  it("leaves out the mutual-defection cell of the Prisoner's Dilemma", () => {
    expect(paretoOptimal(CANONICAL_GAMES['prisoners-dilemma'])).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ]);
  });

  it('keeps only the cell that beats every other one in Stag Hunt', () => {
    expect(paretoOptimal(CANONICAL_GAMES['stag-hunt'])).toEqual([{ r: 0, c: 0 }]);
  });

  it('treats a weak gain for one player and a tie for the other as a domination', () => {
    const game: PayoffMatrix = { rows: 1, cols: 2, row: [[2, 2]], col: [[2, 3]] };
    expect(paretoOptimal(game)).toEqual([{ r: 0, c: 1 }]);
  });

  it('keeps cells with identical payoffs, because neither strictly improves on the other', () => {
    const game: PayoffMatrix = { rows: 1, cols: 2, row: [[2, 2]], col: [[2, 2]] };
    expect(paretoOptimal(game)).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ]);
  });

  it('matches the definition on 500 seeded games', () => {
    forSeeds((seed) => {
      const { rows, cols } = sizeFor(seed);
      const game = randomGame(seed + 2000, rows, cols, 3);
      const cells: CellRef[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push({ r, c });
        }
      }
      // b dominates a: weakly better for both players, strictly better for at least one.
      const dominates = (b: CellRef, a: CellRef) => {
        const rowB = game.row[b.r][b.c];
        const colB = game.col[b.r][b.c];
        const rowA = game.row[a.r][a.c];
        const colA = game.col[a.r][a.c];
        return rowB >= rowA && colB >= colA && (rowB > rowA || colB > colA);
      };
      const expectedCells = cells.filter((a) => !cells.some((b) => dominates(b, a)));
      expect(paretoOptimal(game)).toEqual(expectedCells);
    });
  });
});
