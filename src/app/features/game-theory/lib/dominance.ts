import type { EliminationStep, Player, PayoffMatrix } from './matrix.types';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** True when strategy a of `player` pays strictly more than b against every opponent in `opponents`. */
function beatsEverywhere(
  m: PayoffMatrix,
  player: Player,
  a: number,
  b: number,
  opponents: number[],
): boolean {
  if (a === b || opponents.length === 0) {
    return false;
  }
  return opponents.every((k) =>
    player === 'row' ? m.row[a][k] > m.row[b][k] : m.col[k][a] > m.col[k][b],
  );
}

/** Strict, pure-strategy dominance: a pays the player strictly more than b against every opponent strategy. */
export function strictlyDominates(m: PayoffMatrix, p: Player, a: number, b: number): boolean {
  return beatsEverywhere(m, p, a, b, range(p === 'row' ? m.cols : m.rows));
}

/**
 * The next strict elimination in canonical order: the row player before the column player, and
 * within a player the lowest index first. The dominator is the lowest-index strategy that remains.
 * Dominance is judged only against the opponent strategies that remain (the reduced game).
 */
function firstElimination(
  m: PayoffMatrix,
  rows: number[],
  cols: number[],
): { player: Player; eliminated: number; dominatedBy: number } | null {
  for (const player of ['row', 'col'] as const) {
    const own = player === 'row' ? rows : cols;
    const opponents = player === 'row' ? cols : rows;
    for (const a of own) {
      const dominator = own.find((b) => beatsEverywhere(m, player, b, a, opponents));
      if (dominator !== undefined) {
        return { player, eliminated: a, dominatedBy: dominator };
      }
    }
  }
  return null;
}

/**
 * Iterated strict elimination, one strategy per step, in canonical order (see firstElimination).
 * Each step records the strategies that remain after it. Weak dominance is never used (M14).
 */
export function eliminationTrace(m: PayoffMatrix): EliminationStep[] {
  let rows = range(m.rows);
  let cols = range(m.cols);
  const steps: EliminationStep[] = [];
  let found = firstElimination(m, rows, cols);
  while (found) {
    const { player, eliminated, dominatedBy } = found;
    if (player === 'row') {
      rows = rows.filter((r) => r !== eliminated);
    } else {
      cols = cols.filter((c) => c !== eliminated);
    }
    steps.push({ player, eliminated, dominatedBy, remainingRows: rows, remainingCols: cols });
    found = firstElimination(m, rows, cols);
  }
  return steps;
}
