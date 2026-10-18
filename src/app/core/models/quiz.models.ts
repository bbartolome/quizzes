export interface QuizManifestEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  version: number;
  dataPath: string;
  order: number;
  kind: 'traps' | 'calibration';
  format?: 'two-way' | 'four-way';
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

export interface KnowledgeBaseEntry {
  id: string;
  name: string;
  type: 'fallacy' | 'bias';
  shortDefinition: string;
  longExplanation: string;
  example: string;
  commonlyConfusedWith: string[];
  distinguishingTip: string;
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
