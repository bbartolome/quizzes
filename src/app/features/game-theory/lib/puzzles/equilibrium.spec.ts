import { describe, expect, it } from 'vitest';
import { bruteForcePureNash } from '../../../../../testing/brute-force-nash';
import { forSeeds } from '../../../../../testing/seeds';
import { bestResponses, paretoOptimal } from '../matrix';
import type { CellRef, MatrixGame, PayoffMatrix } from '../matrix.types';
import type { Difficulty, EquilibriumPuzzle, PuzzleTag } from '../puzzle.types';
import { mulberry32 } from '../rng';
import { drawEquilibrium, gradeEquilibrium } from './equilibrium';
import { matrixSignature } from './signature';

const cell = (r: number, c: number): CellRef => ({ r, c });

/** Ties: (player, opponent strategy) pairs where more than one strategy is a best response. */
function tieCount(m: PayoffMatrix): number {
  let ties = 0;
  for (let c = 0; c < m.cols; c++) {
    if (bestResponses(m, 'row', c).length > 1) {
      ties++;
    }
  }
  for (let r = 0; r < m.rows; r++) {
    if (bestResponses(m, 'col', r).length > 1) {
      ties++;
    }
  }
  return ties;
}

/** Pure equilibria that are not Pareto optimal, computed independently of the tags under test. */
function nePareto(m: PayoffMatrix): { ne: CellRef[]; notPareto: boolean } {
  const ne = bruteForcePureNash(m);
  const optimal = paretoOptimal(m);
  const notPareto = ne.some((n) => !optimal.some((o) => o.r === n.r && o.c === n.c));
  return { ne, notPareto };
}

function shareOf(values: boolean[]): number {
  return values.filter(Boolean).length / values.length;
}

/** A hand-written puzzle: the prisoner's dilemma, with its one stable cell at (1,1). */
const PD_GAME: MatrixGame = {
  rowLabels: ['Top', 'Bottom'],
  colLabels: ['Left', 'Right'],
  payoffs: {
    rows: 2,
    cols: 2,
    row: [
      [3, 0],
      [5, 1],
    ],
    col: [
      [3, 5],
      [0, 1],
    ],
  },
};

const pdPuzzle: EquilibriumPuzzle = {
  kind: 'equilibrium',
  difficulty: 1,
  game: PD_GAME,
  conceptIds: ['best-response', 'nash-equilibrium', 'pareto-efficiency'],
  tags: ['ne-not-pareto'],
  seedKey: 'test/pd',
  solution: [cell(1, 1)],
};

const MATCHING_PENNIES: MatrixGame = {
  rowLabels: ['Top', 'Bottom'],
  colLabels: ['Left', 'Right'],
  payoffs: {
    rows: 2,
    cols: 2,
    row: [
      [1, 0],
      [0, 1],
    ],
    col: [
      [0, 1],
      [1, 0],
    ],
  },
};

const matchingPenniesPuzzle: EquilibriumPuzzle = {
  ...pdPuzzle,
  game: MATCHING_PENNIES,
  tags: ['no-pure-ne'],
  conceptIds: ['best-response', 'nash-equilibrium'],
  solution: [],
};

const STAG_GAME: MatrixGame = {
  rowLabels: ['Top', 'Bottom'],
  colLabels: ['Left', 'Right'],
  payoffs: {
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
};

const stagPuzzle: EquilibriumPuzzle = {
  ...pdPuzzle,
  game: STAG_GAME,
  tags: ['ne-not-pareto', 'multiple-ne'],
  conceptIds: ['best-response', 'nash-equilibrium', 'pareto-efficiency'],
  solution: [cell(0, 0), cell(1, 1)],
};

describe('equilibrium puzzles, difficulty 1', () => {
  it('is a 2x2 game with exactly one pure equilibrium and no ties, across 1000 seeds', () => {
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(1, mulberry32(seed));
      expect(puzzle.difficulty).toBe(1);
      expect(puzzle.game.payoffs.rows).toBe(2);
      expect(puzzle.game.payoffs.cols).toBe(2);
      expect(puzzle.solution).toHaveLength(1);
      expect(tieCount(puzzle.game.payoffs)).toBe(0);
    }, 1000);
  });
});

describe('equilibrium puzzles, difficulty 2', () => {
  it('draws 0, 1 or 2 equilibria with weights .2, .4 and .4, across 1000 seeds', () => {
    const counts = [0, 0, 0];
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(2, mulberry32(seed));
      counts[puzzle.solution.length]++;
    }, 1000);
    expect(counts[0] / 1000).toBeCloseTo(0.2, 1);
    expect(counts[1] / 1000).toBeCloseTo(0.4, 1);
    expect(counts[2] / 1000).toBeCloseTo(0.4, 1);
  });

  it('is a 2x2 game', () => {
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(2, mulberry32(seed));
      expect(puzzle.game.payoffs.rows).toBe(2);
      expect(puzzle.game.payoffs.cols).toBe(2);
    }, 300);
  });

  it('makes at least 25% of its puzzles ne-not-pareto, across 1000 seeds', () => {
    const flags: boolean[] = [];
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(2, mulberry32(seed));
      flags.push(puzzle.tags.includes('ne-not-pareto'));
    }, 1000);
    expect(shareOf(flags)).toBeGreaterThanOrEqual(0.25);
  });
});

describe('equilibrium puzzles, difficulty 3', () => {
  it('is a 3x3 game with one to three pure equilibria and at most one tie, across 1000 seeds', () => {
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(3, mulberry32(seed));
      expect(puzzle.game.payoffs.rows).toBe(3);
      expect(puzzle.game.payoffs.cols).toBe(3);
      expect(puzzle.solution.length).toBeGreaterThanOrEqual(1);
      expect(puzzle.solution.length).toBeLessThanOrEqual(3);
      expect(tieCount(puzzle.game.payoffs)).toBeLessThanOrEqual(1);
    }, 1000);
  });
});

describe('equilibrium puzzles at every difficulty', () => {
  const difficulties: Difficulty[] = [1, 2, 3];

  it.each(difficulties)(
    'stores the brute-force equilibria as the solution (difficulty %i)',
    (d) => {
      forSeeds((seed) => {
        const { puzzle } = drawEquilibrium(d, mulberry32(seed));
        expect(puzzle.solution).toEqual(bruteForcePureNash(puzzle.game.payoffs));
      }, 300);
    },
  );

  it.each(difficulties)('uses integer payoffs from 0 to 9 (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(d, mulberry32(seed));
      const values = [...puzzle.game.payoffs.row.flat(), ...puzzle.game.payoffs.col.flat()];
      for (const v of values) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(9);
      }
    }, 200);
  });

  it.each(difficulties)('sets tags that match the game (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(d, mulberry32(seed));
      const { ne, notPareto } = nePareto(puzzle.game.payoffs);
      const expected: PuzzleTag[] = [];
      if (notPareto) {
        expected.push('ne-not-pareto');
      }
      if (ne.length === 0) {
        expected.push('no-pure-ne');
      }
      if (ne.length >= 2) {
        expected.push('multiple-ne');
      }
      expect([...puzzle.tags].sort()).toEqual([...expected].sort());
    }, 300);
  });

  it.each(difficulties)('credits best-response and nash-equilibrium (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const { puzzle } = drawEquilibrium(d, mulberry32(seed));
      expect(puzzle.conceptIds).toContain('best-response');
      expect(puzzle.conceptIds).toContain('nash-equilibrium');
      expect(puzzle.conceptIds.includes('pareto-efficiency')).toBe(
        puzzle.tags.includes('ne-not-pareto'),
      );
    }, 200);
  });

  it.each(difficulties)('is the same for the same rng seed (difficulty %i)', (d) => {
    const first = drawEquilibrium(d, mulberry32(42)).puzzle;
    const second = drawEquilibrium(d, mulberry32(42)).puzzle;
    expect(second).toEqual(first);
  });

  it('sets seedKey from the kind, difficulty and matrix signature, unless the caller gives one', () => {
    const { puzzle } = drawEquilibrium(2, mulberry32(3));
    expect(puzzle.seedKey).toBe(`equilibrium:2:${matrixSignature(puzzle.game)}`);
    const keyed = drawEquilibrium(2, mulberry32(3), { seedKey: 'gt-daily/v1/2026-11-03' });
    expect(keyed.puzzle.seedKey).toBe('gt-daily/v1/2026-11-03');
  });

  it('does not repeat a matrix whose signature is in avoid', () => {
    for (const d of difficulties) {
      const first = drawEquilibrium(d, mulberry32(7)).puzzle;
      const signature = matrixSignature(first.game);
      const next = drawEquilibrium(d, mulberry32(7), { avoid: [signature] }).puzzle;
      expect(matrixSignature(next.game)).not.toBe(signature);
    }
  });
});

describe('equilibrium rejection loop and authored fallback', () => {
  it('stops after 500 tries and then uses the fallback, with a constant rng', () => {
    let draws = 0;
    const counting = () => {
      draws++;
      return 0;
    };
    const { puzzle, usedFallback } = drawEquilibrium(1, counting);
    expect(usedFallback).toBe(true);
    // Difficulty 1 draws 8 payoffs per try: 500 tries, then no more draws.
    expect(draws).toBe(500 * 8);
    expect(puzzle.solution).toHaveLength(1);
  });

  it('draws one count, then 8 payoffs per try at difficulty 2, capped at 500 tries', () => {
    let draws = 0;
    const counting = () => {
      draws++;
      return 0;
    };
    drawEquilibrium(2, counting);
    expect(draws).toBe(1 + 500 * 8);
  });

  it('draws 18 payoffs per try at difficulty 3, capped at 500 tries', () => {
    let draws = 0;
    const counting = () => {
      draws++;
      return 0;
    };
    drawEquilibrium(3, counting);
    expect(draws).toBe(500 * 18);
  });

  it.each([
    [1, 0.5, 1],
    [2, 0.1, 0],
    [2, 0.5, 1],
    [2, 0.9, 2],
    [3, 0.5, 3],
  ] as const)(
    'the fallback at difficulty %i (rng %s) meets the spec with %i equilibria',
    (d, u, count) => {
      // A constant rng gives a constant game, which never passes, so the fallback is used.
      const { puzzle, usedFallback } = drawEquilibrium(d, () => u);
      expect(usedFallback).toBe(true);
      expect(puzzle.solution).toEqual(bruteForcePureNash(puzzle.game.payoffs));
      expect(puzzle.solution).toHaveLength(count);
      if (d === 1) {
        expect(tieCount(puzzle.game.payoffs)).toBe(0);
      }
      if (d === 3) {
        expect(puzzle.game.payoffs.rows).toBe(3);
        expect(tieCount(puzzle.game.payoffs)).toBeLessThanOrEqual(1);
      }
    },
  );

  it('never uses the fallback in 1000 seeds, at any difficulty', () => {
    for (const d of [1, 2, 3] as const) {
      forSeeds((seed) => {
        expect(drawEquilibrium(d, mulberry32(seed)).usedFallback).toBe(false);
      }, 1000);
    }
  });
});

describe('gradeEquilibrium', () => {
  it('marks the stable cell correct with score 1 and a verdict for every cell', () => {
    const grade = gradeEquilibrium(pdPuzzle, { kind: 'equilibrium', cells: [cell(1, 1)] });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
    expect(grade.cellVerdicts).toEqual({ '0,0': 'tn', '0,1': 'tn', '1,0': 'tn', '1,1': 'tp' });
  });

  it('names the missed stable cell and the unstable pick, and does not say "best outcome"', () => {
    const grade = gradeEquilibrium(pdPuzzle, { kind: 'equilibrium', cells: [cell(0, 0)] });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.cellVerdicts).toEqual({ '0,0': 'fp', '0,1': 'tn', '1,0': 'tn', '1,1': 'fn' });
    expect(grade.note).toMatch(/not stable/);
    expect(grade.note).toMatch(/You missed a stable cell/);
    expect(grade.note).not.toMatch(/best outcome/i);
  });

  it('explains that a stable but Pareto-worse cell is not the best outcome', () => {
    const grade = gradeEquilibrium(pdPuzzle, { kind: 'equilibrium', cells: [cell(1, 1)] });
    expect(grade.note).toMatch(/stable/);
    expect(grade.note).toMatch(/pays both players more/);
    expect(grade.note).not.toMatch(/best outcome/i);
  });

  it('scores an empty answer as correct when there is no pure equilibrium', () => {
    const grade = gradeEquilibrium(matchingPenniesPuzzle, { kind: 'equilibrium', cells: [] });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
    expect(grade.cellVerdicts).toEqual({ '0,0': 'tn', '0,1': 'tn', '1,0': 'tn', '1,1': 'tn' });
  });

  it('marks a pick as wrong when there is no pure equilibrium', () => {
    const grade = gradeEquilibrium(matchingPenniesPuzzle, {
      kind: 'equilibrium',
      cells: [cell(0, 0)],
    });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.note).toMatch(/no pure equilibrium/);
  });

  it('gives partial credit when one of two equilibria is found', () => {
    const grade = gradeEquilibrium(stagPuzzle, { kind: 'equilibrium', cells: [cell(0, 0)] });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0.5);
    expect(grade.cellVerdicts).toEqual({ '0,0': 'tp', '0,1': 'tn', '1,0': 'tn', '1,1': 'fn' });
  });

  it('is correct for both equilibria in any order and with a duplicate', () => {
    const grade = gradeEquilibrium(stagPuzzle, {
      kind: 'equilibrium',
      cells: [cell(1, 1), cell(0, 0), cell(1, 1)],
    });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
  });

  it('takes away credit for an extra wrong cell, and never goes below 0', () => {
    const extra = gradeEquilibrium(stagPuzzle, {
      kind: 'equilibrium',
      cells: [cell(0, 0), cell(1, 1), cell(0, 1)],
    });
    expect(extra.correct).toBe(false);
    expect(extra.score).toBe(0.5);
    expect(extra.cellVerdicts?.['0,1']).toBe('fp');

    const onlyWrong = gradeEquilibrium(stagPuzzle, { kind: 'equilibrium', cells: [cell(0, 1)] });
    expect(onlyWrong.score).toBe(0);
  });

  it('keeps every note free of "best outcome" and "what players will do" (M2, M4)', () => {
    const allCells = [cell(0, 0), cell(0, 1), cell(1, 0), cell(1, 1)];
    const subsets: CellRef[][] = [];
    for (let mask = 0; mask < 16; mask++) {
      subsets.push(allCells.filter((_, bit) => (mask & (1 << bit)) !== 0));
    }
    for (const puzzle of [pdPuzzle, stagPuzzle, matchingPenniesPuzzle]) {
      for (const cells of subsets) {
        const { note } = gradeEquilibrium(puzzle, { kind: 'equilibrium', cells });
        expect(note).not.toMatch(/best outcome|what players will do/i);
      }
    }
  });
});
