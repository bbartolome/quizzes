import { Concept, QuizStats } from '../../core/models/quiz.models';

/** Display values for the progress line. null means "—". */
export interface ProgressDisplay {
  roundsPlayed: string | null;
  accuracy: string | null;
}

/** Progress for the home page, from one kind's stats. Both values are null before the first answer. */
export function progressDisplay(stats: QuizStats): ProgressDisplay {
  const traits = Object.values(stats.perTrait);
  const attempted = traits.reduce((sum, t) => sum + t.attempted, 0);
  if (attempted === 0) {
    return { roundsPlayed: null, accuracy: null };
  }
  const correct = traits.reduce((sum, t) => sum + t.correct, 0);
  return {
    roundsPlayed: String(stats.roundsPlayed),
    accuracy: `${Math.round((correct / attempted) * 100)}%`,
  };
}

/** The concepts of one type, in knowledge-base order. */
export function deckForKind(concepts: Concept[], conceptType: Concept['type']): Concept[] {
  return concepts.filter((c) => c.type === conceptType);
}
