// Type-only. Copied verbatim from docs/specs/game-theory.md §7.1.
// The tutorial runner and guard are implemented by G17.

import type { CellRef, MatrixGame, Player } from './matrix.types';
import type { Difficulty, PuzzleKind } from './puzzle.types';

export type TutorialStep =
  | { stage: 1; kind: 'text'; blocks: string[]; callout?: string }
  | {
      stage: 1;
      kind: 'worked';
      game: MatrixGame;
      annotations: { text: string; mark?: MarkName; at?: CellRef; strategy?: { player: Player; index: number } }[];
    }
  | {
      stage: 2;
      kind: 'faded';
      game: MatrixGame;
      task: FadedTask;
      given?: CellRef[]; // cells already shown, for underline-best-responses
      hints: string[];
    }
  | { stage: 2; kind: 'card'; hints: string[] }
  | { stage: 3; kind: 'solo'; source: SoloSource; count: 3; passAt: 2 };
export interface TutorialScript {
  conceptId: string;
  steps: TutorialStep[];
}
export type MarkName = 'best-response-row' | 'best-response-col' | 'equilibrium' | 'dominated' | 'pareto';
export type FadedTask = 'underline-best-responses' | 'find-equilibrium' | 'eliminate-next';
export type SoloSource =
  { puzzle: PuzzleKind; difficulty: Difficulty } | 'cards' | 'name-bot' | 'reason-check';
