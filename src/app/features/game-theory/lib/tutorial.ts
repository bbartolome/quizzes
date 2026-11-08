import type { GameTheoryConcept } from '../../../core/models/quiz.models';
import { strictlyDominates } from './dominance';
import type { CellRef, MatrixGame, Player } from './matrix.types';
import { resolveMark } from './tutorial-marks';
import type { FadedTask, SoloSource, TutorialScript, TutorialStep } from './tutorial.types';

// Tutorials (spec §7.1). Pure: the default script, the faded-task grader and the test source.

const FALLBACK_HINT = 'Look for the feature the definition names.';

/** A strategy as the elimination widget names it: a player and that player's index. */
export interface Strategy {
  player: Player;
  index: number;
}

/**
 * The script for a concept with no hand-written tutorial (spec §7.1): a text Explore built from its
 * entry, one card Try with its spotting tip as the hint, and a Solo of three cards that passes at two.
 */
export function defaultScript(concept: GameTheoryConcept): TutorialScript {
  const explore: TutorialStep = {
    stage: 1,
    kind: 'text',
    blocks: [concept.shortDefinition, concept.longExplanation, concept.example],
    callout: concept.spottingTip,
  };
  const tryCard: TutorialStep = {
    stage: 2,
    kind: 'card',
    hints: [concept.spottingTip ?? FALLBACK_HINT],
  };
  const solo: TutorialStep = { stage: 3, kind: 'solo', source: 'cards', count: 3, passAt: 2 };
  return { conceptId: concept.id, steps: [explore, tryCard, solo] };
}

/** The Solo source of the seed and hand-written concepts (spec §7.2). Other concepts test on cards. */
const TEST_SOURCES: Readonly<Record<string, SoloSource>> = {
  'best-response': { puzzle: 'equilibrium', difficulty: 1 },
  'nash-equilibrium': { puzzle: 'equilibrium', difficulty: 1 },
  'pareto-efficiency': { puzzle: 'equilibrium', difficulty: 2 },
  'dominant-strategy': { puzzle: 'eliminate', difficulty: 1 },
  'iterated-elimination': { puzzle: 'eliminate', difficulty: 1 },
  'prisoners-dilemma': { puzzle: 'classify', difficulty: 1 },
  'stag-hunt': { puzzle: 'classify', difficulty: 1 },
  'chicken-game': { puzzle: 'classify', difficulty: 1 },
  'coordination-game': { puzzle: 'classify', difficulty: 1 },
  'battle-of-the-sexes': { puzzle: 'classify', difficulty: 1 },
};

/** The source for a test-out and for a Solo set of a concept. */
export function testSourceFor(concept: GameTheoryConcept): SoloSource {
  return TEST_SOURCES[concept.id] ?? 'cards';
}

function isStrategy(answer: readonly CellRef[] | Strategy): answer is Strategy {
  return !Array.isArray(answer);
}

function cellKey(cell: CellRef): string {
  return `${cell.r},${cell.c}`;
}

function sameCells(a: readonly CellRef[], b: readonly CellRef[]): boolean {
  const left = new Set(a.map(cellKey));
  const right = new Set(b.map(cellKey));
  return left.size === right.size && [...left].every((key) => right.has(key));
}

/** Every strategy strictly dominated by another, for both players, in the full game. */
function dominatedNow(game: MatrixGame): Strategy[] {
  const m = game.payoffs;
  const out: Strategy[] = [];
  for (const player of ['row', 'col'] as const) {
    const count = player === 'row' ? m.rows : m.cols;
    for (let a = 0; a < count; a++) {
      const beaten = Array.from({ length: count }, (_, b) => b).some(
        (b) => b !== a && strictlyDominates(m, player, b, a),
      );
      if (beaten) out.push({ player, index: a });
    }
  }
  return out;
}

/**
 * Grades one faded task against the solver (spec §7.1). Try records nothing, so this only says
 * whether to show the next hint.
 * - find-equilibrium: the chosen cells are the pure equilibria. An empty choice is right when there are none.
 * - find-pareto: the chosen cells are the Pareto-efficient cells. There is always at least one, so there is no None.
 * - underline-best-responses: the chosen cells, not counting given ones, are the row player's best responses not already given.
 * - eliminate-next: the chosen strategy is strictly dominated now.
 */
export function checkFaded(
  task: FadedTask,
  game: MatrixGame,
  answer: readonly CellRef[] | Strategy,
  given: readonly CellRef[] = [],
): boolean {
  switch (task) {
    case 'find-equilibrium':
      return Array.isArray(answer) && sameCells(answer, resolveMark('equilibrium', game).cells);
    case 'find-pareto':
      return Array.isArray(answer) && sameCells(answer, resolveMark('pareto', game).cells);
    case 'underline-best-responses': {
      if (!Array.isArray(answer)) return false;
      const already = new Set(given.map(cellKey));
      const remaining = resolveMark('best-response-row', game).cells.filter(
        (cell) => !already.has(cellKey(cell)),
      );
      const picked = answer.filter((cell) => !already.has(cellKey(cell)));
      return sameCells(picked, remaining);
    }
    case 'eliminate-next': {
      if (!isStrategy(answer)) return false;
      return dominatedNow(game).some((s) => s.player === answer.player && s.index === answer.index);
    }
  }
}
