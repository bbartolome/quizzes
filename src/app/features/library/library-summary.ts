import { QuizCard } from './library-cards';

export interface CollectionSummary {
  totalRounds: number;
  accuracy: number | null;
  recentlyPlayed: QuizCard | null;
}

/**
 * Totals across every card, and the most recently played card. "Most recently played" is the
 * latest `lastPlayedAt` instant. When no card has one, it falls back to the highest answer streak,
 * ties broken by rounds played, so existing players still see something.
 */
export function summarize(
  cards: readonly QuizCard[],
  lastPlayedAt: Readonly<Record<string, string>>,
): CollectionSummary {
  let totalRounds = 0;
  let correct = 0;
  let attempted = 0;
  for (const card of cards) {
    totalRounds += card.roundsPlayed;
    correct += card.correct;
    attempted += card.attempted;
  }
  return {
    totalRounds,
    accuracy: attempted > 0 ? correct / attempted : null,
    recentlyPlayed: latestPlayed(cards, lastPlayedAt) ?? streakLeader(cards),
  };
}

function latestPlayed(
  cards: readonly QuizCard[],
  lastPlayedAt: Readonly<Record<string, string>>,
): QuizCard | null {
  let best: QuizCard | null = null;
  let bestAt = -Infinity;
  for (const card of cards) {
    const iso = lastPlayedAt[card.entry.id];
    const at = iso === undefined ? NaN : Date.parse(iso);
    if (!Number.isNaN(at) && at > bestAt) {
      best = card;
      bestAt = at;
    }
  }
  return best;
}

function streakLeader(cards: readonly QuizCard[]): QuizCard | null {
  let best: QuizCard | null = null;
  let bestStreak = -1;
  let bestRounds = -1;
  for (const card of cards) {
    const newer =
      card.streak > bestStreak || (card.streak === bestStreak && card.roundsPlayed > bestRounds);
    if (newer) {
      bestStreak = card.streak;
      bestRounds = card.roundsPlayed;
      best = card;
    }
  }
  return best;
}
