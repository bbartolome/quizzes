import { describe, expect, it } from 'vitest';
import type { GameTheoryConcept } from '../../../core/models/quiz.models';
import type { MatrixGame } from './matrix.types';
import { checkFaded, defaultScript, testSourceFor } from './tutorial';

function concept(
  id: string,
  modes: GameTheoryConcept['modes'],
  tier: GameTheoryConcept['tier'] = 1,
): GameTheoryConcept {
  return {
    id,
    name: id,
    type: 'game-theory',
    shortDefinition: `${id}, in one line.`,
    longExplanation: `${id}, explained in a paragraph.`,
    example: `An example of ${id}.`,
    spottingTip: `Spot ${id} by its payoffs.`,
    tier,
    prerequisites: [],
    modes,
  };
}

// Prisoner's dilemma: row payoffs [[3,0],[5,1]], column payoffs [[3,5],[0,1]].
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

describe('defaultScript (spec §7.1: the eight concepts with no hand-written tutorial)', () => {
  it('has three stages in order: a text Explore, one card Try, and a Solo of cards', () => {
    const script = defaultScript(concept('repeated-game', ['cards', 'bots'], 3));

    expect(script.conceptId).toBe('repeated-game');
    expect(script.steps.map((step) => [step.stage, step.kind])).toEqual([
      [1, 'text'],
      [2, 'card'],
      [3, 'solo'],
    ]);
  });

  it('draws its Explore from the concept entry: the definition, the explanation and the example', () => {
    const script = defaultScript(concept('repeated-game', ['cards'], 3));
    const explore = script.steps[0];

    expect(explore).toMatchObject({ kind: 'text' });
    if (explore.kind !== 'text') throw new Error('expected a text step');
    expect(explore.blocks).toEqual([
      'repeated-game, in one line.',
      'repeated-game, explained in a paragraph.',
      'An example of repeated-game.',
    ]);
    expect(explore.callout).toBe('Spot repeated-game by its payoffs.');
  });

  it('gives the card Try a hint from the spotting tip, and a solo of three cards passing at two', () => {
    const script = defaultScript(concept('repeated-game', ['cards'], 3));

    expect(script.steps[1]).toMatchObject({ stage: 2, kind: 'card', hints: ['Spot repeated-game by its payoffs.'] });
    expect(script.steps[2]).toEqual({ stage: 3, kind: 'solo', source: 'cards', count: 3, passAt: 2 });
  });

  it('falls back to a generic hint when the concept has no spotting tip', () => {
    const plain = { ...concept('repeated-game', ['cards'], 3), spottingTip: undefined };
    const script = defaultScript(plain);

    expect(script.steps[1]).toMatchObject({ hints: ['Look for the feature the definition names.'] });
  });
});

describe('checkFaded (spec §7.1 faded tasks, graded by the solver)', () => {
  it('find-equilibrium: right when the chosen cells are the pure equilibria', () => {
    expect(checkFaded('find-equilibrium', PD, [{ r: 1, c: 1 }])).toBe(true);
    expect(checkFaded('find-equilibrium', PD, [{ r: 0, c: 0 }])).toBe(false);
    expect(checkFaded('find-equilibrium', PD, [])).toBe(false);
  });

  it('find-equilibrium: an empty choice is right only when there is no pure equilibrium', () => {
    const pennies: MatrixGame = {
      ...PD,
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

    expect(checkFaded('find-equilibrium', pennies, [])).toBe(true);
    expect(checkFaded('find-equilibrium', pennies, [{ r: 0, c: 0 }])).toBe(false);
  });

  it('underline-best-responses: right when the chosen cells are the row best responses not already given', () => {
    // Row best responses are (1,0) and (1,1). With (1,0) given, the player should underline (1,1) only.
    expect(checkFaded('underline-best-responses', PD, [{ r: 1, c: 1 }], [{ r: 1, c: 0 }])).toBe(true);
    expect(
      checkFaded('underline-best-responses', PD, [{ r: 1, c: 1 }, { r: 1, c: 0 }], [{ r: 1, c: 0 }]),
    ).toBe(false);
  });

  it('eliminate-next: right when the strategy chosen is strictly dominated now', () => {
    // Row Cooperate (index 0) is strictly dominated by Defect. Column player has no dominated strategy
    // here, because it is the other player's payoffs that decide the column dominance.
    expect(checkFaded('eliminate-next', PD, { player: 'row', index: 0 })).toBe(true);
    expect(checkFaded('eliminate-next', PD, { player: 'row', index: 1 })).toBe(false);
  });
});

describe('testSourceFor (spec §7.2 test-out, which the solo step shares)', () => {
  it('uses the equilibrium generator at difficulty 1 for the seed concepts', () => {
    expect(testSourceFor(concept('best-response', ['cards', 'equilibrium']))).toEqual({
      puzzle: 'equilibrium',
      difficulty: 1,
    });
    expect(testSourceFor(concept('nash-equilibrium', ['cards', 'equilibrium']))).toEqual({
      puzzle: 'equilibrium',
      difficulty: 1,
    });
  });

  it('uses difficulty 2 for pareto-efficiency, so ne-not-pareto items come up', () => {
    expect(testSourceFor(concept('pareto-efficiency', ['cards', 'equilibrium']))).toEqual({
      puzzle: 'equilibrium',
      difficulty: 2,
    });
  });

  it('uses the elimination generator for the two elimination concepts and the classify generator for the classes', () => {
    expect(testSourceFor(concept('dominant-strategy', ['cards', 'eliminate']))).toEqual({
      puzzle: 'eliminate',
      difficulty: 1,
    });
    expect(testSourceFor(concept('stag-hunt', ['cards', 'classify']))).toEqual({
      puzzle: 'classify',
      difficulty: 1,
    });
  });

  it('uses cards for a default-script concept', () => {
    expect(testSourceFor(concept('repeated-game', ['cards', 'bots'], 3))).toBe('cards');
  });
});
