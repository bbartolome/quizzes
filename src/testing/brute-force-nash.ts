import type { CellRef, PayoffMatrix } from '../app/features/game-theory/lib/matrix.types';

/**
 * Reference for pure Nash equilibria, for tests to compare the production solver against (spec §4.2).
 * It checks every cell against every deviation directly, without the best-response helpers the
 * solver uses, so a bug in those helpers cannot hide in both places at once.
 */
export function bruteForcePureNash(m: PayoffMatrix): CellRef[] {
  const cells: CellRef[] = [];
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      let rowHappy = true;
      for (let alt = 0; alt < m.rows; alt++) {
        if (m.row[alt][c] > m.row[r][c]) {
          rowHappy = false;
        }
      }
      let colHappy = true;
      for (let alt = 0; alt < m.cols; alt++) {
        if (m.col[r][alt] > m.col[r][c]) {
          colHappy = false;
        }
      }
      if (rowHappy && colHappy) {
        cells.push({ r, c });
      }
    }
  }
  return cells;
}
