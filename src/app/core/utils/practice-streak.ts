import { REST_DAY_CAP, StreakState } from '../models/practice.models';
import { addDays, DateKey, dayNumber } from './dates';

// The shape and cap live in practice.models.ts (prefactor R2); re-exported here
// so the streak rules and their callers share one definition.
export { REST_DAY_CAP };
export type { StreakState };

const REFILL_INTERVAL_DAYS = 7;
const COVERED_LIMIT = 10;

/** A player who has never practised: one rest day, first refill a week after the first practice. */
export function initialStreak(firstPractice: DateKey): StreakState {
  return {
    current: 0,
    longest: 0,
    lastPracticeDate: null,
    restDays: 1,
    nextRestDayOn: addDays(firstPractice, REFILL_INTERVAL_DAYS),
    covered: [],
  };
}

/** Grants one rest day per due refill while below the cap. Pure. */
export function refillRestDays(s: StreakState, today: DateKey): StreakState {
  let restDays = s.restDays;
  let nextRestDayOn = s.nextRestDayOn;
  const todayNumber = dayNumber(today);

  while (nextRestDayOn !== null && restDays < REST_DAY_CAP && todayNumber >= dayNumber(nextRestDayOn)) {
    restDays += 1;
    nextRestDayOn = restDays >= REST_DAY_CAP ? null : addDays(nextRestDayOn, REFILL_INTERVAL_DAYS);
  }

  if (restDays === s.restDays && nextRestDayOn === s.nextRestDayOn) return s;
  return { ...s, restDays, nextRestDayOn };
}

function withPracticeDay(s: StreakState, current: number, today: DateKey): StreakState {
  return { ...s, current, longest: Math.max(s.longest, current), lastPracticeDate: today };
}

/** Records a qualifying practice day on `today`. Idempotent within a day; clock skew is a no-op. */
export function applyPracticeDay(s: StreakState, today: DateKey): StreakState {
  if (s.lastPracticeDate !== null && dayNumber(today) - dayNumber(s.lastPracticeDate) <= 0) {
    return s;
  }

  const refilled = refillRestDays(s, today);
  if (refilled.lastPracticeDate === null) {
    return withPracticeDay(refilled, 1, today);
  }

  const last = refilled.lastPracticeDate;
  const gap = dayNumber(today) - dayNumber(last);
  if (gap === 1) {
    return withPracticeDay(refilled, refilled.current + 1, today);
  }

  const missed = gap - 1;
  if (missed > refilled.restDays) {
    return withPracticeDay(refilled, 1, today);
  }

  const coveredDates = Array.from({ length: missed }, (_, i) => addDays(last, i + 1));
  return {
    ...withPracticeDay(refilled, refilled.current + 1, today),
    restDays: refilled.restDays - missed,
    nextRestDayOn: refilled.nextRestDayOn ?? addDays(today, REFILL_INTERVAL_DAYS),
    covered: [...refilled.covered, ...coveredDates].slice(-COVERED_LIMIT),
  };
}

/** The streak the UI shows on `today`: a dead streak reads 0 even before it is reset in storage. */
export function effectiveStreak(s: StreakState, today: DateKey): number {
  if (s.lastPracticeDate === null) return 0;

  const gap = dayNumber(today) - dayNumber(s.lastPracticeDate);
  if (gap <= 1) return s.current;

  const refilled = refillRestDays(s, today);
  return gap - 1 <= refilled.restDays ? s.current : 0;
}
