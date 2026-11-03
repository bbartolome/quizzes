import type { MisconceptionId } from '../../features/game-theory/lib/puzzle.types';

export type CalibrationFormat = 'two-way' | 'four-way';

export interface QuizManifestEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  version: number;
  dataPath?: string;
  order: number;
  kind: 'traps' | 'calibration' | 'biases' | 'fallacies' | 'game-theory';
  format?: CalibrationFormat;
  /** Calibration entries only: items per round (default 20). */
  roundSize?: number;
}

export interface QuizManifest {
  quizzes: QuizManifestEntry[];
}

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  category: 'fallacy' | 'bias';
  tags: string[];
  explanation: string;
  difficulty: number;
}

export interface Template {
  id: string;
  pattern: string;
  slots: Record<string, string[]>;
  correctAnswers: string[];
  distractors: string[];
  category: 'fallacy' | 'bias';
  explanation: string;
}

/** The fields every flash-card concept has. Game-theory concepts extend this too. */
export interface CardConcept {
  id: string;
  name: string;
  shortDefinition: string;
  longExplanation: string;
  example: string;
  spottingTip?: string;
  type: string;
}

export interface Concept extends CardConcept {
  type: 'fallacy' | 'bias';
}

export interface ConfusedPair {
  concepts: [string, string];
  tip?: string;
}

export interface ConceptSet<C extends CardConcept> {
  concepts: C[];
  pairs: ConfusedPair[];
}

export type KnowledgeBase = ConceptSet<Concept>;

export interface GameTheoryConcept extends CardConcept {
  type: 'game-theory';
  tier: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  misconception?: MisconceptionId;
  source?: { label: string; url: string };
  modes: ('cards' | 'equilibrium' | 'classify' | 'eliminate' | 'bots' | 'beauty' | 'auction')[];
}

export interface GameTheoryContent {
  version: number;
  concepts: GameTheoryConcept[];
  pairs: ConfusedPair[];
}

export interface PerTraitStats {
  traitId: string;
  correct: number;
  attempted: number;
}

export interface QuizStats {
  quizId: string;
  version: number;
  perTrait: Record<string, PerTraitStats>;
  streak: number;
  roundsPlayed: number;
}

export interface RoundQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  traitIds: string[];
  explanation: string;
  sourceTemplateId?: string;
}

export interface ScoredQuestionResult {
  question: RoundQuestion;
  selected: string[];
  correct: boolean;
  missed: string[];
  extra: string[];
}

/** Per-quiz data folder. Only Reasoning Traps and Confidence entries have one (spec §3.1). */
export function requireDataPath(entry: QuizManifestEntry): string {
  if (!entry.dataPath) {
    throw new Error(`Quiz "${entry.id}" has no dataPath`);
  }
  return entry.dataPath;
}
