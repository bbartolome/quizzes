import { bestResponseMarks, paretoOptimal, pureNash } from './matrix';
import type { CellRef, MatrixGame, Player } from './matrix.types';
import { eliminationTrace } from './dominance';
import type { MarkName } from './tutorial.types';

// Tutorial marks (spec §7.1). A worked example names which solver output to draw, and the solver
// supplies the cells, so tutorial text can never contradict the solver. A guard checks every
// annotated game (tutorials.guard.spec.ts).

/** What a mark draws: cells for the matrix marks, and strategies for the dominance mark. */
export interface ResolvedMarks {
  cells: CellRef[];
  strategies: { player: Player; index: number }[];
}

function cellsWhere(flags: boolean[][]): CellRef[] {
  return flags.flatMap((row, r) => row.flatMap((on, c) => (on ? [{ r, c }] : [])));
}

/**
 * The solver output for one mark. `dominated` is the first step of the elimination trace, in
 * canonical order, so it shows one strategy at a time.
 */
export function resolveMark(mark: MarkName, game: MatrixGame): ResolvedMarks {
  const m = game.payoffs;
  switch (mark) {
    case 'best-response-row':
      return { cells: cellsWhere(bestResponseMarks(m).row), strategies: [] };
    case 'best-response-col':
      return { cells: cellsWhere(bestResponseMarks(m).col), strategies: [] };
    case 'equilibrium':
      return { cells: pureNash(m), strategies: [] };
    case 'pareto':
      return { cells: paretoOptimal(m), strategies: [] };
    case 'dominated': {
      const [first] = eliminationTrace(m);
      return {
        cells: [],
        strategies: first ? [{ player: first.player, index: first.eliminated }] : [],
      };
    }
  }
}
