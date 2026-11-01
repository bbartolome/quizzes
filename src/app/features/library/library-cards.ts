import { QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
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
}

export function routeFor(entry: QuizManifestEntry): string {
  return `${ROUTE_PREFIX[entry.kind]}/${entry.id}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function statsCard(entry: QuizManifestEntry, s: QuizStats): QuizCard {
  let correct = 0;
  let attempted = 0;
  for (const value of Object.values(s.perTrait)) {
    correct += value.correct;
    attempted += value.attempted;
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
  };
}
