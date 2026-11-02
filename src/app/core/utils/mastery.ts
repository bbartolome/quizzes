import { ConceptEvidence, MasteryState, PracticeState } from '../models/practice.models';

type ConceptDayEntry = PracticeState['conceptDays'][string];

/**
 * Mastery state of one concept, evaluated on read (practice-layer.md §6). Pure.
 *
 * Uses the same smoothed rate as drawWeight: p = (correct + 0.5) / (attempted + 1).
 * Legacy counts: a concept with attempted > 0 and no conceptDays entry counts as 1 day
 * (see daysFor). The caller passes that in as `days`.
 */
export function masteryOf(e: ConceptEvidence): MasteryState {
  if (e.attempted === 0) {
    return 'new';
  }
  const p = (e.correct + 0.5) / (e.attempted + 1);
  const challengeDone = !e.requiresChallenge || (e.challengeAttempts ?? 0) >= 3;
  if (e.attempted >= 8 && p >= 0.8 && e.days >= 2 && challengeDone) {
    return 'mastered';
  }
  if (e.attempted >= 4 && p >= 0.6) {
    return 'practised';
  }
  return 'learning';
}

/**
 * Distinct practice days for a concept. A concept with attempted > 0 and no conceptDays
 * entry (recorded before per-day tracking) counts as one day, so existing players aren't penalised.
 */
export function daysFor(entry: ConceptDayEntry | undefined, attempted: number): number {
  if (entry !== undefined) {
    return entry.days;
  }
  return attempted > 0 ? 1 : 0;
}
