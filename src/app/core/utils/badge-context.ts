// Red-commit stub for P7b. The implementation commit replaces these bodies.
import type { BadgeContext, MasteryState, PracticeState } from '../models/practice.models';
import type { Concept, ConfusedPair, QuizStats } from '../models/quiz.models';

export interface BadgeSource {
  concepts: readonly Concept[];
  pairs: readonly ConfusedPair[];
  stats: readonly QuizStats[];
  conceptDays: PracticeState['conceptDays'];
  calibration: BadgeContext['calibration'];
}

export function buildBadgeContext(_source: BadgeSource): BadgeContext {
  const mastery = new Map<string, MasteryState>();
  return { mastery, pairs: [], calibration: [], extra: {} };
}

export function badgesToRecord(
  _source: BadgeSource,
  _already: Readonly<Record<string, unknown>>,
): { id: string; evidence: string }[] {
  return [];
}
