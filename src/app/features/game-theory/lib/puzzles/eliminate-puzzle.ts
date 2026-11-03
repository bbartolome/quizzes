import { eliminationTrace, strictlyDominates } from '../dominance';
import type { CellRef, PayoffMatrix, Player } from '../matrix.types';
import type { Difficulty, EliminatePuzzle, PuzzleAnswer, PuzzleGrade } from '../puzzle.types';
import type { Rng } from '../rng';
import { MAX_TRIES, drawPayoff, seedKeyFor, tagsFor, type PuzzleOptions } from './shared';
import { payoffSignature } from './signature';

// Elimination puzzles (spec §5.2). Draw order: one draw before the candidates picks the shape at
// difficulty 3 (below 1/3 is 3x3, below 2/3 is 2 rows by 3 columns, otherwise 3 by 2). Each candidate
// then takes the row player's payoffs row-major, then the column player's. Difficulty 1 and 2 are 3x3.
// Only strict, pure-strategy dominance removes a strategy (spec §11 M14).

type EliminateAnswer = Extract<PuzzleAnswer, { kind: 'eliminate' }>;
type Move = EliminateAnswer['moves'][number];

/** The drawn puzzle, and whether the authored fallback had to be used. */
export interface EliminateDraw {
  puzzle: EliminatePuzzle;
  usedFallback: boolean;
}

interface State {
  rows: number[];
  cols: number[];
}

const ROW_LABELS: Record<number, string[]> = {
  2: ['Top', 'Bottom'],
  3: ['Top', 'Middle', 'Bottom'],
};
const COL_LABELS: Record<number, string[]> = {
  2: ['Left', 'Right'],
  3: ['Left', 'Middle', 'Right'],
};

/** Authored games for the fallback. Each one meets its difficulty's spec. */
const FALLBACK_ONE_STEP = (): PayoffMatrix => ({
  rows: 3,
  cols: 3,
  row: [
    [1, 3, 2],
    [3, 2, 3],
    [0, 0, 0],
  ],
  col: [
    [3, 3, 1],
    [1, 3, 3],
    [2, 2, 0],
  ],
});

const FALLBACK_TWO_STEPS = (): PayoffMatrix => ({
  rows: 3,
  cols: 3,
  row: [
    [3, 3, 1],
    [2, 2, 0],
    [3, 0, 0],
  ],
  col: [
    [1, 1, 0],
    [1, 1, 2],
    [3, 2, 0],
  ],
});

const FALLBACK_SINGLE_CELL = (): PayoffMatrix => ({
  rows: 3,
  cols: 3,
  row: [
    [2, 2, 2],
    [0, 1, 1],
    [0, 0, 0],
  ],
  col: [
    [1, 3, 0],
    [1, 3, 0],
    [2, 2, 1],
  ],
});

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

function drawGridOf(rng: Rng, rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => drawPayoff(rng)));
}

/** Difficulty 3 board shape, drawn once. Three steps need a 2x3 or 3x2 board to end at one cell. */
function drawShape(rng: Rng): [number, number] {
  const u = rng();
  if (u < 1 / 3) {
    return [3, 3];
  }
  return u < 2 / 3 ? [2, 3] : [3, 2];
}

/** A strategy's payoff against one opponent strategy, for the player who owns it. */
function payoffOf(m: PayoffMatrix, player: Player, own: number, opp: number): number {
  return player === 'row' ? m.row[own][opp] : m.col[opp][own];
}

/** The game restricted to the rows and columns still in play. Dominance is judged in this smaller game. */
function reducedGame(m: PayoffMatrix, s: State): PayoffMatrix {
  return {
    rows: s.rows.length,
    cols: s.cols.length,
    row: s.rows.map((r) => s.cols.map((c) => m.row[r][c])),
    col: s.rows.map((r) => s.cols.map((c) => m.col[r][c])),
  };
}

/** Positions b, in the reduced game, that strictly dominate position a. Returns the lowest such b. */
function strictDominatorOf(sub: PayoffMatrix, player: Player, a: number): number | undefined {
  const count = player === 'row' ? sub.rows : sub.cols;
  for (let b = 0; b < count; b++) {
    if (b !== a && strictlyDominates(sub, player, b, a)) {
      return b;
    }
  }
  return undefined;
}

/** A position that weakly dominates a: never worse, and better somewhere. Used only to explain a refusal. */
function weakDominatorOf(sub: PayoffMatrix, player: Player, a: number): number | undefined {
  const count = player === 'row' ? sub.rows : sub.cols;
  const opponents = player === 'row' ? sub.cols : sub.rows;
  for (let b = 0; b < count; b++) {
    if (b === a) {
      continue;
    }
    let never = true;
    let somewhere = false;
    for (let k = 0; k < opponents; k++) {
      const vb = payoffOf(sub, player, b, k);
      const va = payoffOf(sub, player, a, k);
      if (vb < va) {
        never = false;
      }
      if (vb > va) {
        somewhere = true;
      }
    }
    if (never && somewhere) {
      return b;
    }
  }
  return undefined;
}

/** The first legal elimination from a state: row before column, lowest index first. */
function firstLegal(
  m: PayoffMatrix,
  s: State,
): { player: Player; index: number; by: number } | undefined {
  const sub = reducedGame(m, s);
  for (const player of ['row', 'col'] as const) {
    const own = player === 'row' ? s.rows : s.cols;
    for (let a = 0; a < own.length; a++) {
      const by = strictDominatorOf(sub, player, a);
      if (by !== undefined) {
        return { player, index: own[a], by: own[by] };
      }
    }
  }
  return undefined;
}

function removeStrategy(s: State, move: Move): State {
  if (move.player === 'row') {
    return { rows: s.rows.filter((r) => r !== move.index), cols: s.cols };
  }
  return { rows: s.rows, cols: s.cols.filter((c) => c !== move.index) };
}

function accepts(difficulty: Difficulty, payoffs: PayoffMatrix): boolean {
  const trace = eliminationTrace(payoffs);
  if (difficulty === 1) {
    return trace.length === 1;
  }
  if (difficulty === 2) {
    return trace.length === 2 && trace[0].player !== trace[1].player;
  }
  const last = trace[trace.length - 1];
  return last !== undefined && last.remainingRows.length === 1 && last.remainingCols.length === 1;
}

function build(
  difficulty: Difficulty,
  payoffs: PayoffMatrix,
  opts: PuzzleOptions,
): EliminatePuzzle {
  const trace = eliminationTrace(payoffs);
  const last = trace[trace.length - 1];
  const finalRows = last ? last.remainingRows : range(payoffs.rows);
  const finalCols = last ? last.remainingCols : range(payoffs.cols);
  const finalCells: CellRef[] = finalRows.flatMap((r) => finalCols.map((c) => ({ r, c })));
  return {
    kind: 'eliminate',
    difficulty,
    game: {
      rowLabels: [...ROW_LABELS[payoffs.rows]],
      colLabels: [...COL_LABELS[payoffs.cols]],
      payoffs,
    },
    conceptIds: ['dominant-strategy', 'iterated-elimination'],
    tags: tagsFor(payoffs),
    seedKey: seedKeyFor('eliminate', difficulty, payoffs, opts.seedKey),
    solution: trace,
    finalCells,
  };
}

/**
 * Draws an elimination puzzle and reports whether the authored fallback was used. Candidates are
 * tried up to MAX_TRIES times, skipping any whose signature is in opts.avoid.
 */
export function drawEliminateWithFallback(
  difficulty: Difficulty,
  rng: Rng,
  opts: PuzzleOptions = {},
): EliminateDraw {
  const [rows, cols] = difficulty === 3 ? drawShape(rng) : [3, 3];
  const avoid = new Set(opts.avoid ?? []);
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const row = drawGridOf(rng, rows, cols);
    const col = drawGridOf(rng, rows, cols);
    const payoffs: PayoffMatrix = { rows, cols, row, col };
    if (accepts(difficulty, payoffs)) {
      if (avoid.size === 0 || !avoid.has(payoffSignature(payoffs))) {
        return { puzzle: build(difficulty, payoffs, opts), usedFallback: false };
      }
    }
  }
  const fallback =
    difficulty === 1
      ? FALLBACK_ONE_STEP()
      : difficulty === 2
        ? FALLBACK_TWO_STEPS()
        : FALLBACK_SINGLE_CELL();
  return { puzzle: build(difficulty, fallback, opts), usedFallback: true };
}

/** Draws an elimination puzzle. See drawEliminateWithFallback for the draw order and the fallback. */
export function drawEliminate(
  difficulty: Difficulty,
  rng: Rng,
  opts: PuzzleOptions = {},
): EliminatePuzzle {
  return drawEliminateWithFallback(difficulty, rng, opts).puzzle;
}

/** A readable name for one strategy, for example "Row Bottom" or "Column Left". */
function strategyName(m: PayoffMatrix, player: Player, index: number): string {
  return player === 'row'
    ? `Row ${ROW_LABELS[m.rows][index]}`
    : `Column ${COL_LABELS[m.cols][index]}`;
}

/** Why a move is refused in the current state, or undefined when it is legal. */
function refusal(m: PayoffMatrix, s: State, move: Move, step: number): string | undefined {
  const size = move.player === 'row' ? m.rows : m.cols;
  const own = move.player === 'row' ? s.rows : s.cols;
  const name = (i: number) => strategyName(m, move.player, i);
  if (move.index < 0 || move.index >= size) {
    return `Step ${step}: that is not a strategy in this game.`;
  }
  if (!own.includes(move.index)) {
    return `Step ${step}: ${name(move.index)} has already been removed.`;
  }
  if (firstLegal(m, s) === undefined) {
    return `Step ${step}: the game is already at its end. No remaining strategy is strictly dominated, so there is nothing to remove.`;
  }
  const sub = reducedGame(m, s);
  const a = own.indexOf(move.index);
  if (strictDominatorOf(sub, move.player, a) !== undefined) {
    return undefined;
  }
  const weak = weakDominatorOf(sub, move.player, a);
  if (weak !== undefined) {
    return `Step ${step}: ${name(move.index)} only ties ${name(own[weak])} against some opponent strategy, so it is not strictly dominated. Only strict dominance removes a strategy.`;
  }
  return `Step ${step}: ${name(move.index)} is not strictly dominated by any remaining strategy.`;
}

/**
 * Grades a sequence of eliminations. Any legal order is accepted. The first illegal move stops the
 * grading, and moves after it are ignored. A wrong answer never scores 1.
 */
export function gradeEliminate(p: EliminatePuzzle, a: EliminateAnswer): PuzzleGrade {
  const { payoffs, rowLabels, colLabels } = p.game;
  let state: State = { rows: range(payoffs.rows), cols: range(payoffs.cols) };
  let legal = 0;
  let firstIllegalMove: number | undefined;
  let illegalNote = '';
  for (let i = 0; i < a.moves.length; i++) {
    const problem = refusal(payoffs, state, a.moves[i], i + 1);
    if (problem) {
      firstIllegalMove = i;
      illegalNote = problem;
      break;
    }
    state = removeStrategy(state, a.moves[i]);
    legal++;
  }

  const next = firstLegal(payoffs, state);
  const finished = next === undefined;
  const correct = firstIllegalMove === undefined && finished;
  const stoppedEarly = firstIllegalMove === undefined && !finished;
  const steps = p.solution.length;
  const score = correct ? 1 : Math.min(legal, steps - 1) / steps;

  let note: string;
  if (firstIllegalMove !== undefined) {
    note = illegalNote;
  } else if (stoppedEarly && next) {
    note = `You stopped early: ${strategyName(payoffs, next.player, next.index)} is still strictly dominated by ${strategyName(payoffs, next.player, next.by)}, so it can be removed.`;
  } else {
    const rowNames = [...new Set(p.finalCells.map((c) => rowLabels[c.r]))];
    const colNames = [...new Set(p.finalCells.map((c) => colLabels[c.c]))];
    const left =
      p.finalCells.length === 1
        ? `(${rowNames[0]}, ${colNames[0]})`
        : `rows ${rowNames.join(' and ')} and columns ${colNames.join(' and ')}`;
    note = `Correct. Removing strictly dominated strategies, in any order, leaves ${left}. Only strict dominance removes a strategy: one that merely ties another is kept, because removing it can change the answer.`;
  }
  return { correct, score, firstIllegalMove, stoppedEarly, note };
}
