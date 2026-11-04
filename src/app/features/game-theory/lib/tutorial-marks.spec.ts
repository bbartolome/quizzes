import { describe, expect, it } from 'vitest';
import type { MatrixGame } from './matrix.types';
import { resolveMark } from './tutorial-marks';

// Prisoner's dilemma, rows and columns C then D. Row payoffs [[3,0],[5,1]]; column payoffs
// [[3,5],[0,1]], where col[r][c] is the column player's payoff in cell (r, c).
const PD: MatrixGame = {
  rowLabels: ['Cooperate', 'Defect'],
  colLabels: ['Cooperate', 'Defect'],
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

// Matching pennies: no pure equilibrium, nothing strictly dominated.
const PENNIES: MatrixGame = {
  rowLabels: ['Heads', 'Tails'],
  colLabels: ['Heads', 'Tails'],
  payoffs: {
    rows: 2,
    cols: 2,
    row: [
      [1, -1],
      [-1, 1],
    ],
    col: [
      [-1, 1],
      [1, -1],
    ],
  },
};

const sorted = (cells: { r: number; c: number }[]) =>
  [...cells].sort((a, b) => a.r - b.r || a.c - b.c);

describe('resolveMark (spec §7.1: marks come from the solver, never from text)', () => {
  it('marks the cells where the row player is at a best response', () => {
    const marks = resolveMark('best-response-row', PD);

    expect(sorted(marks.cells)).toEqual([
      { r: 1, c: 0 },
      { r: 1, c: 1 },
    ]);
    expect(marks.strategies).toEqual([]);
  });

  it('marks the cells where the column player is at a best response', () => {
    const marks = resolveMark('best-response-col', PD);

    expect(sorted(marks.cells)).toEqual([
      { r: 0, c: 1 },
      { r: 1, c: 1 },
    ]);
  });

  it('marks the pure equilibria, and nothing when there is none', () => {
    expect(resolveMark('equilibrium', PD).cells).toEqual([{ r: 1, c: 1 }]);
    expect(resolveMark('equilibrium', PENNIES).cells).toEqual([]);
  });

  it('marks Pareto-optimal cells, which leaves out the equilibrium that everyone prefers to escape', () => {
    const cells = resolveMark('pareto', PD).cells;

    expect(cells).toContainEqual({ r: 0, c: 0 });
    expect(cells).not.toContainEqual({ r: 1, c: 1 });
  });

  it('marks the first elimination step as dominated, row before column, lowest index first', () => {
    const marks = resolveMark('dominated', PD);

    expect(marks.strategies).toEqual([{ player: 'row', index: 0 }]);
    expect(marks.cells).toEqual([]);
  });

  it('marks no strategy as dominated when no strategy is strictly dominated', () => {
    expect(resolveMark('dominated', PENNIES).strategies).toEqual([]);
  });
});
