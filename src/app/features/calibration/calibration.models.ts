export type CalibrationFormat = 'two-way' | 'four-way';

export type Topic = 'history' | 'science' | 'geography' | 'nature' | 'culture' | 'numbers';

export const TOPICS: readonly Topic[] = [
  'history',
  'science',
  'geography',
  'nature',
  'culture',
  'numbers',
];

export interface ItemSource {
  label: string;
  url: string;
}

export interface TwoWayItem {
  id: string;
  prompt: string;
  options: [string, string];
  correct: 0 | 1;
  topic: Topic;
  fact: string;
  source: ItemSource;
}

export interface FourWayItem {
  id: string;
  prompt: string;
  options: [string, string];
  truth: [boolean, boolean];
  topic: Topic;
  facts: [string, string];
  source: ItemSource;
}

export type CalibrationItem = TwoWayItem | FourWayItem;

export function isFourWayItem(item: CalibrationItem): item is FourWayItem {
  return 'truth' in item;
}

export interface CalibrationBank {
  version: number;
  items: CalibrationItem[];
}

/** Always in bank order, never on-screen order. */
export type CalibrationPick = number | [boolean, boolean];

export interface CalibrationAnswer {
  itemId: string;
  pick: CalibrationPick;
  confidence: number;
  correct: boolean;
}

export interface CalibrationRound {
  submittedAt: string;
  bankVersion: number;
  answers: CalibrationAnswer[];
}

export interface CalibrationSummary {
  roundsPlayed: number;
  brierSum: number;
  answerCount: number;
}

/** `swapped`: on-screen A is bank option 1. */
export interface DrawnItem {
  itemId: string;
  swapped: boolean;
}

/** Bank order. */
export interface PendingPick {
  pick?: CalibrationPick;
  confidence?: number;
}

export interface PendingRound {
  bankVersion: number;
  items: DrawnItem[];
  picks: Record<string, PendingPick>;
}

export interface CalibrationHistory {
  quizId: string;
  bankVersion: number;
  log: CalibrationRound[];
  summary: CalibrationSummary;
  pending: PendingRound | null;
}

/** `pct`, `lo` and `hi` are 0–100, null when `n` is 0. */
export interface BucketStat {
  stop: number;
  n: number;
  hits: number;
  pct: number | null;
  lo: number | null;
  hi: number | null;
}

/** On-screen sides. */
export type FourWayChoice = 'neither' | 'a' | 'b' | 'both';

export type AnswerFlag = 'miss-at-100' | 'below-chance';

export type ReviewGroup = 'confident-miss' | 'hedged-miss' | 'underplayed-hit' | 'confident-hit';
