// Type-only. Copied verbatim from docs/specs/game-theory.md §5.2 and §5.3.
// Functions (generatePuzzle, gradePuzzle, matrixSignature) are implemented by G11-G13 and G16.

import type { CellRef, GameClass, EliminationStep, MatrixGame, Player } from './matrix.types';

export type PuzzleKind = 'equilibrium' | 'classify' | 'eliminate';
export type Difficulty = 1 | 2 | 3;
export type PuzzleTag = 'ne-not-pareto' | 'no-pure-ne' | 'multiple-ne';
interface PuzzleBase {
  kind: PuzzleKind;
  difficulty: Difficulty;
  game: MatrixGame;
  conceptIds: string[];
  tags: PuzzleTag[];
  seedKey: string;
}
export interface EquilibriumPuzzle extends PuzzleBase {
  kind: 'equilibrium';
  solution: CellRef[];
}
export interface ClassifyPuzzle extends PuzzleBase {
  kind: 'classify';
  solution: GameClass;
  choices: GameClass[];
}
export interface EliminatePuzzle extends PuzzleBase {
  kind: 'eliminate';
  solution: EliminationStep[];
  finalCells: CellRef[];
}
export type Puzzle = EquilibriumPuzzle | ClassifyPuzzle | EliminatePuzzle;
export type PuzzleAnswer =
  | { kind: 'equilibrium'; cells: CellRef[] } // empty = "no pure equilibrium"
  | { kind: 'classify'; choice: GameClass }
  | { kind: 'eliminate'; moves: { player: Player; index: number }[]; done: boolean };
export interface PuzzleGrade {
  correct: boolean; // what StatsService records
  score: number; // 0..1 partial credit, shown only
  cellVerdicts?: Record<string, 'tp' | 'fp' | 'fn' | 'tn'>; // key "r,c"
  firstIllegalMove?: number;
  stoppedEarly?: boolean;
  note: string; // misconception-aware text
}

// §5.3 reason checks
export type MisconceptionId =
  'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M10' | 'M11' | 'M12' | 'M13' | 'M14'; // M9 is not used
export interface ReasonCheck {
  id: string;
  conceptId: string;
  context:
    | 'equilibrium'
    | 'classify'
    | 'eliminate'
    | 'bots'
    | 'beauty'
    | 'auction-first'
    | 'auction-second'
    | 'auction-common'
    | 'daily';
  prompt: string;
  options: {
    id: string;
    text: string;
    correct: boolean;
    misconceptionId?: MisconceptionId;
    why: string;
  }[];
}
