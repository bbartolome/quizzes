import { bestResponseMarks, paretoOptimal, pureNash } from './matrix';
import type { CellRef, MatrixGame, PayoffMatrix, Player } from './matrix.types';
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

/** What a note names: the cell a matrix mark draws, or the strategy `dominated` strikes. */
export interface NoteRef {
  at?: CellRef;
  strategy?: { player: Player; index: number };
}

/** The solver's cells, narrowed to the one cell a note names when it names one. */
function namedCell(cells: CellRef[], at: CellRef | undefined): CellRef[] {
  if (!at) return cells;
  return cells.filter((cell) => cell.r === at.r && cell.c === at.c);
}

/** True when the elimination trace strikes this strategy at some step. */
function traceStrikes(m: PayoffMatrix, strategy: { player: Player; index: number }): boolean {
  return eliminationTrace(m).some(
    (step) => step.player === strategy.player && step.eliminated === strategy.index,
  );
}

/**
 * The solver output for one mark. For the matrix marks, `ref.at` is the cell the note is about, and
 * only that cell is drawn if the solver marks it. Without `at`, every cell the solver marks is
 * returned. `dominated` strikes the strategy `ref.strategy` names, and only when the elimination
 * trace strikes it. A dominated note that names no strategy, or one the trace never strikes,
 * strikes nothing. `at` does not apply to `dominated`.
 */
export function resolveMark(mark: MarkName, game: MatrixGame, ref: NoteRef = {}): ResolvedMarks {
  const m = game.payoffs;
  switch (mark) {
    case 'best-response-row':
      return { cells: namedCell(cellsWhere(bestResponseMarks(m).row), ref.at), strategies: [] };
    case 'best-response-col':
      return { cells: namedCell(cellsWhere(bestResponseMarks(m).col), ref.at), strategies: [] };
    case 'equilibrium':
      return { cells: namedCell(pureNash(m), ref.at), strategies: [] };
    case 'pareto':
      return { cells: namedCell(paretoOptimal(m), ref.at), strategies: [] };
    case 'dominated': {
      const named = ref.strategy;
      if (!named || !traceStrikes(m, named)) return { cells: [], strategies: [] };
      return { cells: [], strategies: [{ player: named.player, index: named.index }] };
    }
  }
}
