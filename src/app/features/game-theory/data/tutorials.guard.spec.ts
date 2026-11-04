import { describe, expect, it } from 'vitest';
import type { GameTheoryConcept, GameTheoryContent } from '../../../core/models/quiz.models';
import type { CellRef, MatrixGame } from '../lib/matrix.types';
import { testSourceFor } from '../lib/tutorial';
import type { MarkName, TutorialScript, TutorialStep } from '../lib/tutorial.types';
import { resolveMark } from '../lib/tutorial-marks';
import conceptsJson from '../../../../../public/data/quizzes/game-theory/concepts.json';
import tutorialsJson from '../../../../../public/data/quizzes/game-theory/tutorials.json';

// Build-time guards over the hand-written tutorials (spec §6.5, §7.1). Every annotated mark must
// agree with the solver, so tutorial text cannot contradict it.

const content = conceptsJson as unknown as GameTheoryContent;
const concepts: GameTheoryConcept[] = content.concepts;
const byId = new Map(concepts.map((c) => [c.id, c]));
const file = tutorialsJson as unknown as { version: number; tutorials: TutorialScript[] };

/** The modes that need a hand-written script, because a puzzle or a classify item teaches them. */
const SCRIPTED_MODES: readonly GameTheoryConcept['modes'][number][] = [
  'equilibrium',
  'classify',
  'eliminate',
];
const CELL_MARKS: readonly MarkName[] = ['best-response-row', 'best-response-col', 'equilibrium', 'pareto'];
const STAGE_ORDER = [1, 2, 3] as const;

function cellKey(cell: CellRef): string {
  return `${cell.r},${cell.c}`;
}

describe('tutorials.json (spec §6.5, §7.1)', () => {
  it('has unique concept ids, each naming a real concept', () => {
    const ids = file.tutorials.map((t) => t.conceptId);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(byId.has(id), `unknown concept ${id}`).toBe(true);
    }
  });

  it('has a hand-written script for every concept whose modes include equilibrium, classify or eliminate', () => {
    const scripted = new Set(file.tutorials.map((t) => t.conceptId));
    const needed = concepts.filter((c) => c.modes.some((mode) => SCRIPTED_MODES.includes(mode)));

    for (const concept of needed) {
      expect(scripted.has(concept.id), `missing tutorial for ${concept.id}`).toBe(true);
    }
  });

  it('runs its stages in order and ends with a Solo', () => {
    for (const tutorial of file.tutorials) {
      const stages = tutorial.steps.map((step) => step.stage);
      expect(stages, tutorial.conceptId).toEqual([...stages].sort((a, b) => a - b));
      expect(tutorial.steps.at(-1)?.kind, tutorial.conceptId).toBe('solo');
      for (const stage of STAGE_ORDER) {
        expect(
          tutorial.steps.some((step) => step.stage === stage),
          `${tutorial.conceptId} has no stage ${stage}`,
        ).toBe(true);
      }
    }
  });

  it('gives each Solo the source the test-out uses for that concept', () => {
    for (const tutorial of file.tutorials) {
      const concept = byId.get(tutorial.conceptId);
      const solo = tutorial.steps.find((step) => step.kind === 'solo');
      if (!concept || solo?.kind !== 'solo') throw new Error(`no solo for ${tutorial.conceptId}`);
      expect(solo.source, tutorial.conceptId).toEqual(testSourceFor(concept));
      expect(solo.count).toBe(3);
      expect(solo.passAt).toBe(2);
    }
  });

  it('draws each annotated mark from the solver, so the cell it names is one the solver marks', () => {
    for (const tutorial of file.tutorials) {
      for (const step of tutorial.steps) {
        if (step.kind !== 'worked') continue;
        for (const note of step.annotations) {
          if (!note.mark) continue;
          checkAnnotation(tutorial.conceptId, step.game, note.mark, note.at);
        }
      }
    }
  });

  it('gives each text Explore at least one block, and each Try at least one hint', () => {
    for (const tutorial of file.tutorials) {
      for (const step of tutorial.steps) {
        if (step.kind === 'text') {
          expect(step.blocks.length, tutorial.conceptId).toBeGreaterThan(0);
        }
        if (step.kind === 'faded') {
          expect(step.hints.length, tutorial.conceptId).toBeGreaterThan(0);
          checkGivenCells(tutorial.conceptId, step);
        }
      }
    }
  });
});

function checkAnnotation(
  conceptId: string,
  game: MatrixGame,
  mark: MarkName,
  at: CellRef | undefined,
): void {
  const marks = resolveMark(mark, game);
  if (CELL_MARKS.includes(mark)) {
    expect(at, `${conceptId}: ${mark} needs a cell`).toBeDefined();
    if (!at) return;
    const marked = new Set(marks.cells.map(cellKey));
    expect(marked.has(cellKey(at)), `${conceptId}: ${mark} at ${cellKey(at)} is not marked by the solver`).toBe(true);
  } else {
    expect(marks.strategies.length, `${conceptId}: dominated names no strategy`).toBeGreaterThan(0);
  }
}

function checkGivenCells(conceptId: string, step: Extract<TutorialStep, { kind: 'faded' }>): void {
  if (step.task !== 'underline-best-responses') return;
  const marked = new Set(resolveMark('best-response-row', step.game).cells.map(cellKey));
  for (const cell of step.given ?? []) {
    expect(marked.has(cellKey(cell)), `${conceptId}: a given underline is not a best response`).toBe(true);
  }
}
