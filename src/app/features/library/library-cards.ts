import { Concept, QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
import { PracticeState } from '../../core/models/practice.models';
import { pooledConceptCounts } from '../../core/utils/concept-counts';
import { daysFor, masteryOf } from '../../core/utils/mastery';
import { CalibrationSummary, calibrationCardStats } from '../calibration/calibration-card';
import { formatOf } from '../calibration/calibration-format';

/** URL prefix for each collection kind; each kind's pages live under its own prefix. */
const ROUTE_PREFIX: Record<QuizManifestEntry['kind'], string> = {
  traps: '/quiz',
  calibration: '/calibration',
  biases: '/biases',
  fallacies: '/fallacies',
};

export interface QuizCard {
  entry: QuizManifestEntry;
  kind: QuizManifestEntry['kind'];
  streak: number;
  roundsPlayed: number;
  correct: number;
  attempted: number;
  accuracy: number | null;
  skillScore: number | null;
  /** Concepts at Practised or Mastered (N); null when the knowledge base is not known. */
  conceptsPractised?: number | null;
  /** Knowledge-base concepts for this quiz (M); null when the knowledge base is not known. */
  conceptsTotal?: number | null;
}

export function routeFor(entry: QuizManifestEntry): string {
  return `${ROUTE_PREFIX[entry.kind]}/${entry.id}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** The knowledge-base concept ids a quiz covers: Biases and Fallacies by type, Reasoning Traps all of them. */
export function conceptIdsFor(
  kind: QuizManifestEntry['kind'],
  concepts: readonly Concept[],
): string[] {
  const type: Concept['type'] | null =
    kind === 'biases' ? 'bias' : kind === 'fallacies' ? 'fallacy' : null;
  return concepts.filter((c) => type === null || c.type === type).map((c) => c.id);
}

export function statsCard(
  entry: QuizManifestEntry,
  s: QuizStats,
  conceptIds?: readonly string[],
  conceptDays: PracticeState['conceptDays'] = {},
): QuizCard {
  let correct = 0;
  let attempted = 0;
  for (const value of Object.values(s.perTrait)) {
    correct += value.correct;
    attempted += value.attempted;
  }
  let conceptsPractised: number | null = null;
  if (conceptIds) {
    const pooled = pooledConceptCounts([s], new Set(conceptIds));
    conceptsPractised = conceptIds.filter((id) => {
      const row = pooled.get(id) ?? { attempted: 0, correct: 0 };
      const state = masteryOf({
        attempted: row.attempted,
        correct: row.correct,
        days: daysFor(conceptDays[id], row.attempted),
      });
      return state === 'practised' || state === 'mastered';
    }).length;
  }
  return {
    entry,
    kind: entry.kind,
    streak: s.streak,
    roundsPlayed: s.roundsPlayed,
    correct,
    attempted,
    accuracy: attempted > 0 ? correct / attempted : null,
    skillScore: null,
    conceptsPractised,
    conceptsTotal: conceptIds ? conceptIds.length : null,
  };
}

export function calibrationCard(entry: QuizManifestEntry, summary: CalibrationSummary): QuizCard {
  const c = calibrationCardStats(summary, formatOf(entry));
  return {
    entry,
    kind: 'calibration',
    streak: 0,
    roundsPlayed: c.roundsPlayed,
    correct: 0,
    attempted: 0,
    accuracy: null,
    skillScore: c.skillScore,
    conceptsPractised: null,
    conceptsTotal: null,
  };
}
