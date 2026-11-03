import { describe, expect, it } from 'vitest';
import { forSeeds } from '../../../../../testing/seeds';
import { mulberry32 } from '../rng';
import { drawClassify } from './classify-puzzle';
import { drawEquilibrium } from './equilibrium';
import { gradePuzzle, generatePuzzle, matrixSignature } from './index';
import { matrixSignature as signatureFromModule } from './signature';

describe('generatePuzzle', () => {
  it('returns the equilibrium puzzle that the equilibrium generator draws', () => {
    forSeeds((seed) => {
      for (const difficulty of [1, 2, 3] as const) {
        const fromDispatch = generatePuzzle('equilibrium', difficulty, mulberry32(seed));
        const direct = drawEquilibrium(difficulty, mulberry32(seed)).puzzle;
        expect(fromDispatch).toEqual(direct);
      }
    }, 50);
  });

  it('returns the classify puzzle that the classify generator draws', () => {
    forSeeds((seed) => {
      for (const difficulty of [1, 2, 3] as const) {
        expect(generatePuzzle('classify', difficulty, mulberry32(seed))).toEqual(
          drawClassify(difficulty, mulberry32(seed)),
        );
      }
    }, 50);
  });

  it('passes avoid through to the equilibrium generator', () => {
    const first = generatePuzzle('equilibrium', 1, mulberry32(11));
    const next = generatePuzzle('equilibrium', 1, mulberry32(11), {
      avoid: [matrixSignature(first.game)],
    });
    expect(matrixSignature(next.game)).not.toBe(matrixSignature(first.game));
  });
});

describe('gradePuzzle', () => {
  it('grades an equilibrium puzzle against an equilibrium answer', () => {
    const puzzle = generatePuzzle('equilibrium', 1, mulberry32(5));
    if (puzzle.kind !== 'equilibrium') {
      throw new Error('expected an equilibrium puzzle');
    }
    const grade = gradePuzzle(puzzle, { kind: 'equilibrium', cells: puzzle.solution });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
  });

  it('grades a classify puzzle against a classify answer', () => {
    const puzzle = generatePuzzle('classify', 1, mulberry32(5));
    if (puzzle.kind !== 'classify') {
      throw new Error('expected a classify puzzle');
    }
    const grade = gradePuzzle(puzzle, { kind: 'classify', choice: puzzle.solution });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
  });

  it('rejects an answer whose kind does not match the puzzle', () => {
    const puzzle = generatePuzzle('equilibrium', 1, mulberry32(5));
    expect(() => gradePuzzle(puzzle, { kind: 'classify', choice: 'other' })).toThrow(TypeError);
  });
});

describe('matrixSignature', () => {
  it('is the signature module function, re-exported from the index', () => {
    expect(matrixSignature).toBe(signatureFromModule);
  });
});
