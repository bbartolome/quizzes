// Type-only. Copied verbatim from docs/specs/game-theory.md §10.
// The persistence services in state/ read and write these shapes.

import type { PuzzleKind } from './puzzle.types';

export type TutorialStage = 0 | 1 | 2 | 3; // none | explored | tried | solo passed
export interface ConceptLearn {
  stage: TutorialStage;
  testedOut: boolean;
}
export interface LearnState {
  version: 1;
  concepts: Record<string, ConceptLearn>;
  summary: { mastered: number; introduced: number; total: number }; // read by the library with no fetch
  daily: Record<string, { kind: PuzzleKind; correct: boolean; reasonCorrect: boolean }>; // last 60 dates
}
export type GameKind =
  | 'repeated-pd'
  | 'name-the-bot'
  | 'tournament'
  | 'beauty-contest'
  | 'first-price'
  | 'second-price'
  | 'common-value';
export interface MatchRecord {
  kind: GameKind;
  at: string;
  seed: string;
  summary: Record<string, string | number | boolean>;
}
export interface GamesLog {
  version: 1;
  counts: Record<GameKind, number>;
  records: MatchRecord[];
}
