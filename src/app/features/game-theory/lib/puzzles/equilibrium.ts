import { bestResponses, pureNash } from '../matrix';
import type { CellRef, PayoffMatrix } from '../matrix.types';
import type { Difficulty, EquilibriumPuzzle, PuzzleAnswer, PuzzleGrade } from '../puzzle.types';
import type { Rng } from '../rng';
import { MAX_TRIES, drawGrid, seedKeyFor, tagsFor, tieCount, type PuzzleOptions } from './shared';
import { payoffSignature } from './signature';

// Equilibrium puzzles (spec §5.2). Draw order: each candidate game takes the row player's n x n
// payoffs row-major, then the column player's. At difficulty 2 the target equilibrium count comes
// first, from one draw: below .2 is 0 equilibria, below .6 is 1, and anything else is 2.

type Verdict = 'tp' | 'fp' | 'fn' | 'tn';
export type EquilibriumAnswer = Extract<PuzzleAnswer, { kind: 'equilibrium' }>;

/** The drawn puzzle, and whether the authored fallback had to be used. */
export interface EquilibriumDraw {
  puzzle: EquilibriumPuzzle;
  /** True only when every candidate was rejected and the authored fallback was used. */
  usedFallback: boolean;
}

const SIZE: Record<Difficulty, number> = { 1: 2, 2: 2, 3: 3 };

function labelsFor(n: number): { rows: string[]; cols: string[] } {
  return n === 2
    ? { rows: ['Top', 'Bottom'], cols: ['Left', 'Right'] }
    : { rows: ['Top', 'Middle', 'Bottom'], cols: ['Left', 'Middle', 'Right'] };
}

/** Prisoner's dilemma: one pure equilibrium, not Pareto optimal. */
const PRISONERS_DILEMMA = (): PayoffMatrix => ({
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
});

/** Matching pennies: no pure equilibrium. */
const MATCHING_PENNIES = (): PayoffMatrix => ({
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
});

/** Stag hunt: two pure equilibria. */
const STAG_HUNT = (): PayoffMatrix => ({
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
});

/** A 3x3 coordination game with a tie-free diagonal: three pure equilibria. */
const DIAGONAL_3 = (): PayoffMatrix => ({
  rows: 3,
  cols: 3,
  row: [
    [2, 0, 0],
    [0, 2, 0],
    [0, 0, 2],
  ],
  col: [
    [2, 0, 0],
    [0, 2, 0],
    [0, 0, 2],
  ],
});

/** The authored game used when rejection sampling fails. Each one meets its difficulty's spec. */
function fallbackFor(difficulty: Difficulty, target: number | undefined): PayoffMatrix {
  if (difficulty === 3) {
    return DIAGONAL_3();
  }
  if (difficulty === 1 || target === 1) {
    return PRISONERS_DILEMMA();
  }
  return target === 0 ? MATCHING_PENNIES() : STAG_HUNT();
}

/** Difficulty 2 equilibrium count, weighted .2 / .4 / .4 over 0, 1 and 2. */
function drawTargetCount(rng: Rng): number {
  const u = rng();
  if (u < 0.2) {
    return 0;
  }
  return u < 0.6 ? 1 : 2;
}

function accepts(difficulty: Difficulty, m: PayoffMatrix, target: number | undefined): boolean {
  const count = pureNash(m).length;
  if (difficulty === 1) {
    return count === 1 && tieCount(m) === 0;
  }
  if (difficulty === 2) {
    return count === target;
  }
  return count >= 1 && count <= 3 && tieCount(m) <= 1;
}

function build(
  difficulty: Difficulty,
  payoffs: PayoffMatrix,
  opts: PuzzleOptions,
): EquilibriumPuzzle {
  const tags = tagsFor(payoffs);
  const conceptIds = ['best-response', 'nash-equilibrium'];
  if (tags.includes('ne-not-pareto')) {
    conceptIds.push('pareto-efficiency');
  }
  const labels = labelsFor(payoffs.rows);
  return {
    kind: 'equilibrium',
    difficulty,
    game: { rowLabels: labels.rows, colLabels: labels.cols, payoffs },
    conceptIds,
    tags,
    seedKey: seedKeyFor('equilibrium', difficulty, payoffs, opts.seedKey),
    solution: pureNash(payoffs),
  };
}

/**
 * Draws an equilibrium puzzle. Candidates are tried up to MAX_TRIES times, skipping any whose
 * signature is in opts.avoid. If none passes, the authored fallback is used and flagged.
 */
export function drawEquilibrium(
  difficulty: Difficulty,
  rng: Rng,
  opts: PuzzleOptions = {},
): EquilibriumDraw {
  const target = difficulty === 2 ? drawTargetCount(rng) : undefined;
  const n = SIZE[difficulty];
  const avoid = new Set(opts.avoid ?? []);
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const row = drawGrid(rng, n);
    const col = drawGrid(rng, n);
    const payoffs: PayoffMatrix = { rows: n, cols: n, row, col };
    if (accepts(difficulty, payoffs, target)) {
      if (avoid.size === 0 || !avoid.has(payoffSignature(payoffs))) {
        return { puzzle: build(difficulty, payoffs, opts), usedFallback: false };
      }
    }
  }
  return {
    puzzle: build(difficulty, fallbackFor(difficulty, target), opts),
    usedFallback: true,
  };
}

/** True when cell b pays both players at least as much as cell a, and one of them strictly more. */
function paretoDominates(m: PayoffMatrix, b: CellRef, a: CellRef): boolean {
  const rowB = m.row[b.r][b.c];
  const colB = m.col[b.r][b.c];
  const rowA = m.row[a.r][a.c];
  const colA = m.col[a.r][a.c];
  return rowB >= rowA && colB >= colA && (rowB > rowA || colB > colA);
}

function gridCells(m: PayoffMatrix): CellRef[] {
  const cells: CellRef[] = [];
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      cells.push({ r, c });
    }
  }
  return cells;
}

/** Grades an answer against the stored equilibria. Partial credit is shown, and only `correct` is recorded. */
export function gradeEquilibrium(p: EquilibriumPuzzle, a: EquilibriumAnswer): PuzzleGrade {
  const { payoffs, rowLabels, colLabels } = p.game;
  const key = (c: CellRef) => `${c.r},${c.c}`;
  const picked = new Set(a.cells.map(key));
  const stable = new Set(p.solution.map(key));
  const cells = gridCells(payoffs);

  const cellVerdicts: Record<string, Verdict> = {};
  for (const cell of cells) {
    const k = key(cell);
    const isPicked = picked.has(k);
    const isStable = stable.has(k);
    cellVerdicts[k] = isPicked ? (isStable ? 'tp' : 'fp') : isStable ? 'fn' : 'tn';
  }
  const verdictOf = (c: CellRef) => cellVerdicts[key(c)];
  const tp = cells.filter((c) => verdictOf(c) === 'tp').length;
  const fp = cells.filter((c) => verdictOf(c) === 'fp').length;
  const correct = fp === 0 && tp === stable.size;
  const score = stable.size === 0 ? (fp === 0 ? 1 : 0) : Math.max(0, tp - fp) / stable.size;

  const name = (c: CellRef) => `(${rowLabels[c.r]}, ${colLabels[c.c]})`;
  const note = correct ? correctNote(p, name) : wrongNote(p, name, cells, verdictOf, picked.size);
  return { correct, score, cellVerdicts, note };
}

function correctNote(p: EquilibriumPuzzle, name: (c: CellRef) => string): string {
  const { payoffs } = p.game;
  const stable = p.solution;
  let note: string;
  if (stable.length === 0) {
    note = 'Correct. No cell is stable: at every cell, one player gains by switching alone.';
  } else if (stable.length === 1) {
    note = `Correct. ${name(stable[0])} is stable: neither player gains by switching alone.`;
  } else {
    note = `Correct. Each of these ${stable.length} cells is stable: from each, neither player gains by switching alone.`;
  }
  for (const s of stable) {
    const better = gridCells(payoffs).find((b) => paretoDominates(payoffs, b, s));
    if (better) {
      note += ` Stable is not the same as best: ${name(better)} pays both players more than ${name(s)}, yet ${name(s)} is still stable.`;
      break;
    }
  }
  return note;
}

function wrongNote(
  p: EquilibriumPuzzle,
  name: (c: CellRef) => string,
  cells: CellRef[],
  verdictOf: (c: CellRef) => Verdict,
  pickedCount: number,
): string {
  const { payoffs, rowLabels, colLabels } = p.game;
  const stable = p.solution;
  const parts = ['An equilibrium is a cell where neither player gains by switching alone.'];
  const wrongPicks = cells.filter((c) => verdictOf(c) === 'fp');

  if (stable.length === 0) {
    if (wrongPicks.length > 0) {
      parts.push(
        'There is no pure equilibrium here: every cell has a player who gains by switching alone.',
      );
    }
  } else if (pickedCount === 0) {
    const list = stable.map(name).join(' and ');
    parts.push(
      `You said no cell is stable, but ${list} ${stable.length === 1 ? 'is' : 'are'} stable.`,
    );
  } else {
    for (const s of stable.filter((c) => verdictOf(c) === 'fn')) {
      parts.push(
        `You missed a stable cell: ${name(s)}, where neither player gains by switching alone.`,
      );
    }
  }

  for (const c of wrongPicks) {
    const gains: string[] = [];
    const rowBest = bestResponses(payoffs, 'row', c.c);
    const colBest = bestResponses(payoffs, 'col', c.r);
    if (!rowBest.includes(c.r)) {
      gains.push(`the row player would gain by moving to ${rowLabels[rowBest[0]]}`);
    }
    if (!colBest.includes(c.c)) {
      gains.push(`the column player would gain by moving to ${colLabels[colBest[0]]}`);
    }
    parts.push(`${name(c)} is not stable: ${gains.join(' and ')}.`);
  }

  for (const c of wrongPicks) {
    const s = stable.find((x) => paretoDominates(payoffs, c, x));
    if (s) {
      parts.push(
        `Paying both players more does not make a cell stable: ${name(c)} pays both more than ${name(s)}, but a player still gains by switching.`,
      );
      break;
    }
  }
  return parts.join(' ');
}
