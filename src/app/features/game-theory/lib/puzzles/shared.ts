import { bestResponses, paretoOptimal, pureNash } from '../matrix';
import type { CellRef, PayoffMatrix } from '../matrix.types';
import type { Difficulty, PuzzleKind, PuzzleTag } from '../puzzle.types';
import type { Rng } from '../rng';
import { payoffSignature } from './signature';

/** Generators try at most this many candidate games before they use an authored fallback (spec §5.2). */
export const MAX_TRIES = 500;

/** Options every generator accepts. `avoid` lists matrix signatures to skip. `seedKey` overrides the default key. */
export interface PuzzleOptions {
  avoid?: string[];
  seedKey?: string;
}

/** One integer payoff from 0 to 9. Draws one value from rng. */
export function drawPayoff(rng: Rng): number {
  return Math.floor(rng() * 10);
}

/** An n x n grid of payoffs, filled row-major. Draws n * n values from rng. */
export function drawGrid(rng: Rng, n: number): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => drawPayoff(rng)));
}

export function sameCell(a: CellRef, b: CellRef): boolean {
  return a.r === b.r && a.c === b.c;
}

/** Ties: (player, opponent strategy) pairs where more than one strategy is a best response. */
export function tieCount(m: PayoffMatrix): number {
  let ties = 0;
  for (let c = 0; c < m.cols; c++) {
    if (bestResponses(m, 'row', c).length > 1) {
      ties++;
    }
  }
  for (let r = 0; r < m.rows; r++) {
    if (bestResponses(m, 'col', r).length > 1) {
      ties++;
    }
  }
  return ties;
}

/** The puzzle tags that describe the pure equilibria of a game (spec §5.2). */
export function tagsFor(m: PayoffMatrix): PuzzleTag[] {
  const ne = pureNash(m);
  const optimal = paretoOptimal(m);
  const tags: PuzzleTag[] = [];
  if (ne.some((n) => !optimal.some((o) => sameCell(o, n)))) {
    tags.push('ne-not-pareto');
  }
  if (ne.length === 0) {
    tags.push('no-pure-ne');
  }
  if (ne.length >= 2) {
    tags.push('multiple-ne');
  }
  return tags;
}

/**
 * The seed key of a puzzle. A caller that seeded the rng can pass its key. Otherwise the key is
 * built from the kind, the difficulty and the matrix signature, so the same game gives the same key.
 */
export function seedKeyFor(
  kind: PuzzleKind,
  difficulty: Difficulty,
  m: PayoffMatrix,
  given?: string,
): string {
  return given ?? `${kind}:${difficulty}:${payoffSignature(m)}`;
}
