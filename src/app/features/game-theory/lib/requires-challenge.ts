import type { GameTheoryConcept } from '../../../core/models/quiz.models';

/**
 * Whether each concept needs challenge evidence to reach Mastered (spec §7.3): true for any concept
 * whose modes include something other than `cards`. The learn service takes this map on refresh.
 */
export function requiresChallengeMap(concepts: readonly GameTheoryConcept[]): Record<string, boolean> {
  return Object.fromEntries(
    concepts.map((concept): [string, boolean] => [
      concept.id,
      concept.modes.some((mode) => mode !== 'cards'),
    ]),
  );
}
