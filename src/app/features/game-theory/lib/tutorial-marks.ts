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

/** The solver's cells, narrowed to the one cell a note names when it names one. */
function namedCell(cells: CellRef[], at: CellRef | undefined): CellRef[] {
  if (!at) return cells;
  return cells.filter((cell) => cell.r === at.r && cell.c === at.c);
}

/**
 * The solver output for one mark. For the matrix marks, `at` is the cell the note is about, and
 * only that cell is drawn if the solver marks it. Without `at`, every cell the solver marks is
 * returned. `dominated` is the first step of the elimination trace, in canonical order, so it
 * shows one strategy at a time; `at` does not apply to it.
 */
export function resolveMark(mark: MarkName, game: MatrixGame, at?: CellRef): ResolvedMarks {
  const m = game.payoffs;
  switch (mark) {
    case 'best-response-row':
      return { cells: namedCell(cellsWhere(bestResponseMarks(m).row), at), strategies: [] };
    case 'best-response-col':
      return { cells: namedCell(cellsWhere(bestResponseMarks(m).col), at), strategies: [] };
    case 'equilibrium':
      return { cells: namedCell(pureNash(m), at), strategies: [] };
    case 'pareto':
      return { cells: namedCell(paretoOptimal(m), at), strategies: [] };
    case 'dominated': {
      const [first] = eliminationTrace(m);
      return {
        cells: [],
        strategies: first ? [{ player: first.player, index: first.eliminated }] : [],
      };
    }
  }
}
