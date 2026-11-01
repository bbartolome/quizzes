import { QuizCard } from './library-cards';

export interface CollectionSummary {
  totalRounds: number;
  accuracy: number | null;
  recentlyPlayed: QuizCard | null;
}

export function summarize(cards: readonly QuizCard[]): CollectionSummary {
  let totalRounds = 0;
  let correct = 0;
  let attempted = 0;
  let bestStreak = -1;
  let bestRounds = -1;
  let recentlyPlayed: QuizCard | null = null;
  for (const card of cards) {
    totalRounds += card.roundsPlayed;
    correct += card.correct;
    attempted += card.attempted;
    const newer =
      card.streak > bestStreak || (card.streak === bestStreak && card.roundsPlayed > bestRounds);
    if (newer) {
      bestStreak = card.streak;
      bestRounds = card.roundsPlayed;
      recentlyPlayed = card;
    }
  }
  return {
    totalRounds,
    accuracy: attempted > 0 ? correct / attempted : null,
    recentlyPlayed,
  };
}
