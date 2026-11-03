import { describe, expect, it } from 'vitest';
import { bruteForcePureNash } from '../../../../../testing/brute-force-nash';
import { forSeeds } from '../../../../../testing/seeds';
import { eliminationTrace } from '../dominance';
import { paretoOptimal } from '../matrix';
import type { CellRef, PayoffMatrix, Player } from '../matrix.types';
import type { Difficulty, EliminatePuzzle, PuzzleTag } from '../puzzle.types';
import { mulberry32 } from '../rng';
import { drawEliminate, gradeEliminate } from './eliminate-puzzle';
import { matrixSignature } from './signature';

type Move = { player: Player; index: number };

/** A strategy of `player` that is strictly dominated by another remaining strategy, by plain loops. */
function referenceLegalMoves(m: PayoffMatrix, rows: number[], cols: number[]): Move[] {
  const moves: Move[] = [];
  for (const a of rows) {
    if (rows.some((b) => b !== a && cols.every((k) => m.row[b][k] > m.row[a][k]))) {
      moves.push({ player: 'row', index: a });
    }
  }
  for (const a of cols) {
    if (cols.some((b) => b !== a && rows.every((k) => m.col[k][b] > m.col[k][a]))) {
      moves.push({ player: 'col', index: a });
    }
  }
  return moves;
}

/** The cells left when every legal strict elimination has been made, in any order. */
function referenceFinal(m: PayoffMatrix): CellRef[] {
  let rows = Array.from({ length: m.rows }, (_, i) => i);
  let cols = Array.from({ length: m.cols }, (_, i) => i);
  for (;;) {
    const move = referenceLegalMoves(m, rows, cols)[0];
    if (!move) {
      break;
    }
    if (move.player === 'row') {
      rows = rows.filter((r) => r !== move.index);
    } else {
      cols = cols.filter((c) => c !== move.index);
    }
  }
  return rows.flatMap((r) => cols.map((c) => ({ r, c })));
}

const key = (c: CellRef) => `${c.r},${c.c}`;
const sortedKeys = (cells: CellRef[]) => cells.map(key).sort();

/** Ties in best responses are not part of elimination, so only the equilibrium tags are checked. */
function nePareto(m: PayoffMatrix): { ne: CellRef[]; notPareto: boolean } {
  const ne = bruteForcePureNash(m);
  const optimal = paretoOptimal(m);
  const notPareto = ne.some((n) => !optimal.some((o) => o.r === n.r && o.c === n.c));
  return { ne, notPareto };
}

/** Hand-written 2x2 game: the row player's Bottom is strictly dominated by Top, then column Left by Right. */
const TWO_STEPS: EliminatePuzzle = {
  kind: 'eliminate',
  difficulty: 2,
  game: {
    rowLabels: ['Top', 'Bottom'],
    colLabels: ['Left', 'Right'],
    payoffs: {
      rows: 2,
      cols: 2,
      row: [
        [3, 2],
        [1, 0],
      ],
      col: [
        [2, 3],
        [1, 0],
      ],
    },
  },
  conceptIds: ['dominant-strategy', 'iterated-elimination'],
  tags: [],
  seedKey: 'test/two-steps',
  solution: [
    { player: 'row', eliminated: 1, dominatedBy: 0, remainingRows: [0], remainingCols: [0, 1] },
    { player: 'col', eliminated: 0, dominatedBy: 1, remainingRows: [0], remainingCols: [1] },
  ],
  finalCells: [{ r: 0, c: 1 }],
};

/** Hand-written game where Bottom only ties Top against Left, so it is weakly but not strictly dominated. */
const WEAK_ONLY: EliminatePuzzle = {
  kind: 'eliminate',
  difficulty: 1,
  game: {
    rowLabels: ['Top', 'Bottom'],
    colLabels: ['Left', 'Right'],
    payoffs: {
      rows: 2,
      cols: 2,
      row: [
        [1, 1],
        [1, 0],
      ],
      col: [
        [1, 0],
        [1, 0],
      ],
    },
  },
  conceptIds: ['dominant-strategy', 'iterated-elimination'],
  tags: [],
  seedKey: 'test/weak',
  solution: [
    { player: 'col', eliminated: 1, dominatedBy: 0, remainingRows: [0, 1], remainingCols: [0] },
  ],
  finalCells: [
    { r: 0, c: 0 },
    { r: 1, c: 0 },
  ],
};

describe('elimination puzzles, difficulty 1', () => {
  it('is a 3x3 game with one strict step, across 1000 seeds', () => {
    forSeeds((seed) => {
      const { game, solution } = drawEliminate(1, mulberry32(seed));
      expect(game.payoffs.rows).toBe(3);
      expect(game.payoffs.cols).toBe(3);
      expect(solution).toHaveLength(1);
    }, 1000);
  });
});

describe('elimination puzzles, difficulty 2', () => {
  it('is a 3x3 game with two steps that alternate players, across 1000 seeds', () => {
    forSeeds((seed) => {
      const { game, solution } = drawEliminate(2, mulberry32(seed));
      expect(game.payoffs.rows).toBe(3);
      expect(game.payoffs.cols).toBe(3);
      expect(solution).toHaveLength(2);
      expect(solution[0].player).not.toBe(solution[1].player);
    }, 1000);
  });
});

describe('elimination puzzles, difficulty 3', () => {
  it('ends at a single cell in three or four steps, across 1000 seeds', () => {
    forSeeds((seed) => {
      const puzzle = drawEliminate(3, mulberry32(seed));
      expect([3, 4]).toContain(puzzle.solution.length);
      expect(puzzle.finalCells).toHaveLength(1);
    }, 1000);
  });

  it('uses four steps on a 3x3 board and three steps on a 2x3 or 3x2 board', () => {
    forSeeds((seed) => {
      const { game, solution } = drawEliminate(3, mulberry32(seed));
      const threeByThree = game.payoffs.rows === 3 && game.payoffs.cols === 3;
      expect(solution.length).toBe(threeByThree ? 4 : 3);
    }, 500);
  });

  it('draws both shapes', () => {
    const shapes = new Set<string>();
    forSeeds((seed) => {
      const { game } = drawEliminate(3, mulberry32(seed));
      shapes.add(`${game.payoffs.rows}x${game.payoffs.cols}`);
    }, 300);
    expect(shapes).toEqual(new Set(['3x3', '2x3', '3x2']));
  });
});

describe('elimination puzzles at every difficulty', () => {
  const difficulties: Difficulty[] = [1, 2, 3];

  it.each(difficulties)('finishes at the same cells as the reference (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawEliminate(d, mulberry32(seed));
      expect(sortedKeys(puzzle.finalCells)).toEqual(
        sortedKeys(referenceFinal(puzzle.game.payoffs)),
      );
    }, 300);
  });

  it.each(difficulties)('reaches the same final cells in any legal order (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawEliminate(d, mulberry32(seed));
      const pick = mulberry32(seed + 1000);
      for (let trial = 0; trial < 5; trial++) {
        const { payoffs } = puzzle.game;
        let rows = Array.from({ length: payoffs.rows }, (_, i) => i);
        let cols = Array.from({ length: payoffs.cols }, (_, i) => i);
        const moves: Move[] = [];
        for (;;) {
          const legal = referenceLegalMoves(payoffs, rows, cols);
          if (legal.length === 0) {
            break;
          }
          const move = legal[Math.floor(pick() * legal.length)];
          moves.push(move);
          if (move.player === 'row') {
            rows = rows.filter((r) => r !== move.index);
          } else {
            cols = cols.filter((c) => c !== move.index);
          }
        }
        const finalCells = rows.flatMap((r) => cols.map((c) => ({ r, c })));
        expect(sortedKeys(finalCells)).toEqual(sortedKeys(puzzle.finalCells));
        const grade = gradeEliminate(puzzle, { kind: 'eliminate', moves, done: true });
        expect(grade.correct).toBe(true);
        expect(grade.score).toBe(1);
      }
    }, 150);
  });

  it.each(difficulties)('sets tags that match the game (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawEliminate(d, mulberry32(seed));
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
    }, 150);
  });

  it.each(difficulties)(
    'credits dominant-strategy and iterated-elimination (difficulty %i)',
    (d) => {
      const puzzle = drawEliminate(d, mulberry32(4));
      expect(puzzle.conceptIds).toEqual(['dominant-strategy', 'iterated-elimination']);
    },
  );

  it.each(difficulties)('is the same for the same rng seed (difficulty %i)', (d) => {
    expect(drawEliminate(d, mulberry32(42))).toEqual(drawEliminate(d, mulberry32(42)));
  });

  it('sets seedKey from the kind, difficulty and matrix signature, unless the caller gives one', () => {
    const puzzle = drawEliminate(2, mulberry32(3));
    expect(puzzle.seedKey).toBe(`eliminate:2:${matrixSignature(puzzle.game)}`);
    const keyed = drawEliminate(2, mulberry32(3), { seedKey: 'gt-daily/v1/2026-11-03' });
    expect(keyed.seedKey).toBe('gt-daily/v1/2026-11-03');
  });

  it.each(difficulties)(
    'does not repeat a matrix whose signature is in avoid (difficulty %i)',
    (d) => {
      const first = drawEliminate(d, mulberry32(7));
      const signature = matrixSignature(first.game);
      const next = drawEliminate(d, mulberry32(7), { avoid: [signature] });
      expect(matrixSignature(next.game)).not.toBe(signature);
    },
  );
});

describe('elimination rejection loop and authored fallback', () => {
  it.each([
    [1, 9000],
    [2, 9000],
    [3, 9001],
  ] as const)('stops after 500 tries at difficulty %i, then uses the fallback', (d, draws) => {
    let count = 0;
    const counting = () => {
      count++;
      return 0;
    };
    const puzzle = drawEliminate(d, counting);
    // Each 3x3 try draws 18 payoffs. Difficulty 3 draws its shape first, once.
    expect(count).toBe(draws);
    expect(puzzle.game.payoffs.rows).toBe(3);
    expect(puzzle.game.payoffs.cols).toBe(3);
  });

  it.each([1, 2, 3] as const)('the fallback at difficulty %i meets the spec', (d) => {
    // A constant rng gives a constant game, which never eliminates anything, so the fallback is used.
    const puzzle = drawEliminate(d, () => 0.5);
    expect(puzzle.solution).toEqual(eliminationTrace(puzzle.game.payoffs));
    if (d === 1) {
      expect(puzzle.solution).toHaveLength(1);
    }
    if (d === 2) {
      expect(puzzle.solution).toHaveLength(2);
      expect(puzzle.solution[0].player).not.toBe(puzzle.solution[1].player);
    }
    if (d === 3) {
      expect(puzzle.solution).toHaveLength(4);
      expect(puzzle.finalCells).toHaveLength(1);
    }
  });

  it('never uses the fallback in 1000 seeds, at any difficulty', () => {
    for (const d of [1, 2, 3] as const) {
      forSeeds((seed) => {
        const puzzle = drawEliminate(d, mulberry32(seed));
        expect(puzzle.solution.length).toBeGreaterThan(0);
        expect(puzzle.solution).toEqual(eliminationTrace(puzzle.game.payoffs));
      }, 1000);
    }
  });
});

describe('gradeEliminate', () => {
  it('accepts the stored order and scores it 1, with no illegal move and no early stop', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [
        { player: 'row', index: 1 },
        { player: 'col', index: 0 },
      ],
      done: true,
    });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
    expect(grade.firstIllegalMove).toBeUndefined();
    expect(grade.stoppedEarly).toBe(false);
    expect(grade.note).toMatch(/in any order/);
    expect(grade.note).toMatch(/Top, Right/);
    expect(grade.note).toMatch(/Only strict dominance removes a strategy/);
  });

  it('stopping after one of two steps is an early stop, with the share of legal steps as score', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [{ player: 'row', index: 1 }],
      done: true,
    });
    expect(grade.correct).toBe(false);
    expect(grade.stoppedEarly).toBe(true);
    expect(grade.score).toBe(0.5);
    expect(grade.firstIllegalMove).toBeUndefined();
    expect(grade.note).toMatch(/stopped early/);
  });

  it('stopping with no moves scores 0 and reports an early stop', () => {
    const grade = gradeEliminate(TWO_STEPS, { kind: 'eliminate', moves: [], done: true });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.stoppedEarly).toBe(true);
  });

  it('names an undominated strategy as the first illegal move', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [{ player: 'row', index: 0 }],
      done: true,
    });
    expect(grade.correct).toBe(false);
    expect(grade.firstIllegalMove).toBe(0);
    expect(grade.score).toBe(0);
    expect(grade.note).toMatch(/not strictly dominated by any remaining strategy/);
  });

  it('rejects a weakly dominated strategy: only strict dominance removes a strategy (M14)', () => {
    const grade = gradeEliminate(WEAK_ONLY, {
      kind: 'eliminate',
      moves: [{ player: 'row', index: 1 }],
      done: true,
    });
    expect(grade.firstIllegalMove).toBe(0);
    expect(grade.correct).toBe(false);
    expect(grade.note).toMatch(/only ties/);
    expect(grade.note).toMatch(/Only strict dominance removes a strategy/);
  });

  it('counts a move past the end as over-stepping: illegal, and a wrong answer never scores 1', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [
        { player: 'row', index: 1 },
        { player: 'col', index: 0 },
        { player: 'row', index: 0 },
      ],
      done: true,
    });
    expect(grade.firstIllegalMove).toBe(2);
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0.5);
    expect(grade.note).toMatch(/nothing to remove/);
  });

  it('treats a strategy that was already removed as illegal', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [
        { player: 'row', index: 1 },
        { player: 'row', index: 1 },
      ],
      done: true,
    });
    expect(grade.firstIllegalMove).toBe(1);
    expect(grade.note).toMatch(/already been removed/);
  });

  it('ignores every move after the first illegal one', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [
        { player: 'row', index: 0 },
        { player: 'row', index: 1 },
        { player: 'col', index: 0 },
      ],
      done: true,
    });
    expect(grade.firstIllegalMove).toBe(0);
    expect(grade.score).toBe(0);
  });

  it('keeps every note free of "best" claims about outcomes', () => {
    const grade = gradeEliminate(TWO_STEPS, {
      kind: 'eliminate',
      moves: [
        { player: 'row', index: 1 },
        { player: 'col', index: 0 },
      ],
      done: true,
    });
    expect(grade.note).not.toMatch(/best outcome|will play|weakly dominated/i);
  });
});
