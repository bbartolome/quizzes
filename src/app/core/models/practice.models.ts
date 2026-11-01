import { DateKey } from '../utils/dates';
import { CalibrationFormat, ConfusedPair } from './quiz.models';

export const PRACTICE_KEY = 'stats:app:practice';

export interface AttemptInput {
  conceptIds?: readonly string[];
  count?: number; // scored answers this call stands for; default 1
}

export interface PracticeSnapshot {
  enabled: boolean;
  streak: number; // effective streak (practice-layer.md §4.3)
  longest: number;
  restDays: number;
  practicedToday: boolean;
  attemptsToday: number;
}

export interface StreakState {
  current: number;
  longest: number;
  lastPracticeDate: DateKey | null;
  restDays: number;
  nextRestDayOn: DateKey | null;
  covered: DateKey[]; // last 10 dates a rest day covered, informational
}

export const REST_DAY_CAP = 2;

export interface PracticeState {
  version: 1;
  enabled: boolean; // "Hide streak and badges"
  streak: StreakState;
  today: { date: DateKey; attempts: number; dailyDone: boolean };
  lastPlayedAt: Record<string, string>; // quiz id -> ISO instant
  conceptDays: Record<string, { days: number; lastDay: DateKey }>;
  badges: Record<string, { earnedAt: string; evidence: string }>;
}

export type MasteryState = 'new' | 'learning' | 'practised' | 'mastered';

export interface ConceptEvidence {
  attempted: number;
  correct: number;
  days: number; // distinct practice days
  challengeAttempts?: number; // game theory only
  requiresChallenge?: boolean; // the concept has a generated mode
}

export interface BadgeContext {
  mastery: ReadonlyMap<string, MasteryState>;
  pairs: readonly ConfusedPair[];
  calibration: ReadonlyArray<{ confidence: number; correct: boolean; format: CalibrationFormat }>; // lifetime, all three quizzes
  extra: Readonly<Record<string, unknown>>; // game-theory evidence, game-theory.md G28
}

export interface BadgeDef {
  id: string;
  title: string;
  insight: string;
  criterion: string; // shown while unearned, as "Can you show…?"
  earned(ctx: BadgeContext): boolean;
}
