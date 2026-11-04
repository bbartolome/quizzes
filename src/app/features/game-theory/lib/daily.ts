import { dayNumber, type DateKey } from '../../../core/utils/dates';
import type { Difficulty, PuzzleKind } from './puzzle.types';
import { hashSeed, mulberry32, type Rng } from './rng';

// The daily puzzle (spec §9.2). Pure: the seed, the kind rotation and the difficulty cap. The page
// keeps the day's plan in storage, so mastery reached mid-day cannot change today's puzzle.

/** The plan for one day: fixed on its first open, and kept until the date changes. */
export interface DailyPlan {
  version: 1;
  dateKey: DateKey;
  kind: PuzzleKind;
  difficulty: Difficulty;
  seedKey: string;
}

/** The seed key for a date. Keyed to the local date, so no two days share a puzzle. */
export function dailySeedKey(dateKey: DateKey): string {
  return `gt-daily/v1/${dateKey}`;
}

/** The day's rng: the same date gives the same stream, so every visit draws the same puzzle. */
export function dailyRng(dateKey: DateKey): Rng {
  return mulberry32(hashSeed(dailySeedKey(dateKey)));
}

/** The kind for the day: the drawable kinds in turn, one per day. Null when none can be drawn. */
export function dailyKind(dateKey: DateKey, kinds: readonly PuzzleKind[]): PuzzleKind | null {
  if (kinds.length === 0) return null;
  return kinds[dayNumber(dateKey) % kinds.length];
}

/**
 * The difficulty for a kind, capped at 2 so the daily is always solvable (spec §9.2). The gates
 * match the puzzle set: equilibrium at 2 needs nash-equilibrium Practised, and elimination at 2
 * needs dominant-strategy Practised. Classify has no gate at 2.
 */
export function dailyDifficulty(
  kind: PuzzleKind,
  practised: (conceptId: string) => boolean,
): Difficulty {
  if (kind === 'equilibrium') return practised('nash-equilibrium') ? 2 : 1;
  if (kind === 'eliminate') return practised('dominant-strategy') ? 2 : 1;
  return 2;
}

/** The plan for a date, or null when no kind can be drawn yet. */
export function dailyPlanOf(
  dateKey: DateKey,
  drawable: readonly PuzzleKind[],
  practised: (conceptId: string) => boolean,
): DailyPlan | null {
  const kind = dailyKind(dateKey, drawable);
  if (kind === null) return null;
  return {
    version: 1,
    dateKey,
    kind,
    difficulty: dailyDifficulty(kind, practised),
    seedKey: dailySeedKey(dateKey),
  };
}
