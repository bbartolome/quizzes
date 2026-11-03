import type { MatrixGame, PayoffMatrix } from '../matrix.types';

// Canonical form of a payoff matrix (spec §5.2). The signature is the smallest encoding over every
// row order, column order and player swap. Two games with the same signature are the same game up
// to renaming strategies, so a repeat can be spotted. Labels and cover stories are not part of the
// game, so they are ignored.

/** Every ordering of 0..n-1. */
function orderings(n: number): number[][] {
  if (n <= 1) {
    return [Array.from({ length: n }, (_, i) => i)];
  }
  const out: number[][] = [];
  for (const rest of orderings(n - 1)) {
    for (let at = 0; at < n; at++) {
      out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
    }
  }
  return out;
}

function transpose(grid: number[][]): number[][] {
  return grid[0].map((_, c) => grid.map((line) => line[c]));
}

/** The canonical signature of the payoffs alone. */
export function payoffSignature(m: PayoffMatrix): string {
  const candidates: string[] = [];
  for (const swap of [false, true]) {
    const row = swap ? transpose(m.col) : m.row;
    const col = swap ? transpose(m.row) : m.col;
    const rows = row.length;
    const cols = row[0].length;
    for (const rowOrder of orderings(rows)) {
      for (const colOrder of orderings(cols)) {
        const r = rowOrder.map((i) => colOrder.map((j) => row[i][j]));
        const c = rowOrder.map((i) => colOrder.map((j) => col[i][j]));
        candidates.push(`${rows}x${cols}:${r.flat().join(',')}|${c.flat().join(',')}`);
      }
    }
  }
  return candidates.reduce((best, next) => (next < best ? next : best));
}

/** The canonical form of a game, used to avoid repeating a matrix (spec §5.2). */
export function matrixSignature(g: MatrixGame): string {
  return payoffSignature(g.payoffs);
}
