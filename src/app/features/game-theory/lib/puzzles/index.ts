import type { Difficulty, Puzzle, PuzzleAnswer, PuzzleGrade, PuzzleKind } from '../puzzle.types';
import type { Rng } from '../rng';
import { drawClassify, gradeClassify } from './classify-puzzle';
import { drawEliminate, gradeEliminate } from './eliminate-puzzle';
import { drawEquilibrium, gradeEquilibrium } from './equilibrium';
import type { PuzzleOptions } from './shared';

export { matrixSignature } from './signature';
export { classOf } from './classify-puzzle';

/**
 * A puzzle of the given kind and difficulty, drawn from rng. Each generator documents its own draw
 * order. `opts.avoid` lists matrix signatures to skip, so repeats can be avoided.
 */
export function generatePuzzle(
  kind: PuzzleKind,
  difficulty: Difficulty,
  rng: Rng,
  opts: PuzzleOptions = {},
): Puzzle {
  switch (kind) {
    case 'equilibrium':
      return drawEquilibrium(difficulty, rng, opts).puzzle;
    case 'classify':
      return drawClassify(difficulty, rng, opts);
    case 'eliminate':
      return drawEliminate(difficulty, rng, opts);
    default:
      throw new Error(`generatePuzzle: no ${kind} generator yet`);
  }
}

/** Grades an answer. The answer kind must match the puzzle kind. */
export function gradePuzzle(p: Puzzle, a: PuzzleAnswer): PuzzleGrade {
  if (p.kind === 'equilibrium' && a.kind === 'equilibrium') {
    return gradeEquilibrium(p, a);
  }
  if (p.kind === 'classify' && a.kind === 'classify') {
    return gradeClassify(p, a);
  }
  if (p.kind === 'eliminate' && a.kind === 'eliminate') {
    return gradeEliminate(p, a);
  }
  throw new TypeError(`gradePuzzle: a ${a.kind} answer does not fit a ${p.kind} puzzle`);
}
