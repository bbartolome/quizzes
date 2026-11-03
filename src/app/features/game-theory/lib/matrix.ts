import type { CellRef, Player, PayoffMatrix } from './matrix.types';

/** Every index holding the largest value. Ties all count, in ascending order. */
function argmax(values: number[]): number[] {
  const top = Math.max(...values);
  return values.flatMap((value, index) => (value === top ? [index] : []));
}

/**
 * The pure strategies that best answer the opponent's pure strategy `opp`, with ties kept.
 * For the row player, `opp` is a column index. For the column player, `opp` is a row index.
 */
export function bestResponses(m: PayoffMatrix, player: Player, opp: number): number[] {
  if (player === 'row') {
    return argmax(m.row.map((line) => line[opp]));
  }
  return argmax(m.col[opp]);
}

/** Every cell in row-major order. */
function allCells(m: PayoffMatrix): CellRef[] {
  const cells: CellRef[] = [];
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      cells.push({ r, c });
    }
  }
  return cells;
}

/**
 * Underline marks for drawing. `row[r][c]` is true when r is a row best response to column c.
 * `col[r][c]` is true when c is a column best response to row r.
 */
export function bestResponseMarks(m: PayoffMatrix): { row: boolean[][]; col: boolean[][] } {
  const row = Array.from({ length: m.rows }, () => new Array<boolean>(m.cols).fill(false));
  const col = Array.from({ length: m.rows }, () => new Array<boolean>(m.cols).fill(false));
  for (let c = 0; c < m.cols; c++) {
    for (const r of bestResponses(m, 'row', c)) {
      row[r][c] = true;
    }
  }
  for (let r = 0; r < m.rows; r++) {
    for (const c of bestResponses(m, 'col', r)) {
      col[r][c] = true;
    }
  }
  return { row, col };
}

/** Cells where neither player gains by switching alone. A tie does not count as a gain. */
export function pureNash(m: PayoffMatrix): CellRef[] {
  const marks = bestResponseMarks(m);
  return allCells(m).filter(({ r, c }) => marks.row[r][c] && marks.col[r][c]);
}

/** True when cell b weakly improves on cell a for both players and strictly for one. */
function paretoDominates(m: PayoffMatrix, b: CellRef, a: CellRef): boolean {
  const rowB = m.row[b.r][b.c];
  const colB = m.col[b.r][b.c];
  const rowA = m.row[a.r][a.c];
  const colA = m.col[a.r][a.c];
  return rowB >= rowA && colB >= colA && (rowB > rowA || colB > colA);
}

/** Cells that no other cell Pareto-dominates. Identical payoff pairs do not dominate each other. */
export function paretoOptimal(m: PayoffMatrix): CellRef[] {
  const cells = allCells(m);
  return cells.filter((a) => !cells.some((b) => paretoDominates(m, b, a)));
}
