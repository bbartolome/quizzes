import { Concept, QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
import { PracticeState } from '../../core/models/practice.models';
import { pooledConceptCounts } from '../../core/utils/concept-counts';
import { daysFor, masteryOf } from '../../core/utils/mastery';
import { CalibrationSummary, calibrationCardStats } from '../calibration/calibration-card';
import { formatOf } from '../calibration/calibration-format';
import type { LearnState } from '../game-theory/lib/state.types';

/** URL prefix for each collection kind; each kind's pages live under its own prefix. */
const ROUTE_PREFIX: Record<QuizManifestEntry['kind'], string> = {
  traps: '/quiz',
  calibration: '/calibration',
  biases: '/biases',
  'game-theory': '/game-theory',
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
  /** The game-theory daily line: open or done. Null when locked or for other quizzes (spec §3.1). */
  dailyLabel?: string | null;
}

export function routeFor(entry: QuizManifestEntry): string {
  // The game-theory hub has one fixed path, so it has no :id segment.
  if (entry.kind === 'game-theory') {
    return ROUTE_PREFIX['game-theory'];
  }
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
  // Game-theory concepts are not flash-card Concepts; their card counts come from gameTheoryCard.
  if (kind === 'game-theory') {
    return [];
  }
  const type: Concept['type'] | null =
    kind === 'biases' ? 'bias' : kind === 'fallacies' ? 'fallacy' : null;
  return concepts.filter((c) => type === null || c.type === type).map((c) => c.id);
}

/** The game-theory deck size (spec §6.2). A fixed denominator, so the card never reads "N / 0" before the hub is opened. */
const TOTAL_CONCEPTS = 18;

/**
 * Game-theory library card (spec §3.1). Rounds come from the cards key. Accuracy pools the cards
 * and challenges keys (§7.3). Mastery comes from the learn summary, read with no content fetch.
 * The "Daily puzzle" row is deferred to G27.
 */
export function gameTheoryCard(
  entry: QuizManifestEntry,
  learnSummary: LearnState['summary'],
  stats: { cards: QuizStats; challenges: QuizStats },
  daily: { unlocked: boolean; done: boolean } = { unlocked: false, done: false },
): QuizCard {
  let correct = 0;
  let attempted = 0;
  for (const s of [stats.cards, stats.challenges]) {
    for (const value of Object.values(s.perTrait)) {
      correct += value.correct;
      attempted += value.attempted;
    }
  }
  return {
    entry,
    kind: 'game-theory',
    streak: 0,
    roundsPlayed: stats.cards.roundsPlayed,
    correct,
    attempted,
    accuracy: attempted > 0 ? correct / attempted : null,
    skillScore: null,
    conceptsPractised: learnSummary.mastered,
    dailyLabel: daily.unlocked ? (daily.done ? 'done' : 'open') : null,
    conceptsTotal: TOTAL_CONCEPTS,
  };
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
