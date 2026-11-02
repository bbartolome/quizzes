import { describe, it, expect } from 'vitest';
import { addDays, DateKey } from './dates';
import {
  REST_DAY_CAP,
  StreakState,
  applyPracticeDay,
  effectiveStreak,
  initialStreak,
  refillRestDays,
} from './practice-streak';

const D = '2026-03-10';

function streak(p: Partial<StreakState> = {}): StreakState {
  return {
    current: 0,
    longest: 0,
    lastPracticeDate: null,
    restDays: 0,
    nextRestDayOn: null,
    covered: [],
    ...p,
  };
}

describe('REST_DAY_CAP', () => {
  it('is 2', () => {
    expect(REST_DAY_CAP).toBe(2);
  });
});

describe('initialStreak', () => {
  it('starts with no practice, one rest day and the first refill due a week later', () => {
    expect(initialStreak(D)).toEqual({
      current: 0,
      longest: 0,
      lastPracticeDate: null,
      restDays: 1,
      nextRestDayOn: addDays(D, 7),
      covered: [],
    });
  });
});

describe('applyPracticeDay', () => {
  describe('first-ever practice', () => {
    it('starts the streak at 1 and records the date', () => {
      const s = applyPracticeDay(initialStreak(D), D);

      expect(s.current).toBe(1);
      expect(s.longest).toBe(1);
      expect(s.lastPracticeDate).toBe(D);
      expect(s.restDays).toBe(1);
    });

    it('keeps a longest that is already above 1', () => {
      const s = applyPracticeDay(streak({ longest: 5 }), D);

      expect(s.current).toBe(1);
      expect(s.longest).toBe(5);
    });
  });

  describe('same-day repeat (idempotent)', () => {
    it('leaves the state unchanged when already practised today', () => {
      const once = applyPracticeDay(initialStreak(D), D);
      const twice = applyPracticeDay(once, D);

      expect(twice).toEqual(once);
    });
  });

  describe('consecutive day', () => {
    it('adds one to the current streak and raises longest with it', () => {
      const s = applyPracticeDay(streak({ current: 3, longest: 3, lastPracticeDate: D }), addDays(D, 1));

      expect(s.current).toBe(4);
      expect(s.longest).toBe(4);
      expect(s.lastPracticeDate).toBe(addDays(D, 1));
    });

    it('does not spend a rest day when there is no gap', () => {
      const s = applyPracticeDay(
        streak({ current: 1, longest: 1, lastPracticeDate: D, restDays: 2, nextRestDayOn: null }),
        addDays(D, 1),
      );

      expect(s.restDays).toBe(2);
      expect(s.covered).toEqual([]);
    });

    it('crosses the spring-forward DST change as a single day', () => {
      const s = applyPracticeDay(
        streak({ current: 2, longest: 2, lastPracticeDate: '2026-03-07', restDays: 1, nextRestDayOn: '2026-03-20' }),
        '2026-03-08',
      );

      expect(s.current).toBe(3);
      expect(s.restDays).toBe(1);
    });
  });

  describe('clock skew and timezone repeats (no change)', () => {
    it('does not change the state when the clock has gone backwards', () => {
      const s = streak({ current: 4, longest: 4, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 7) });

      expect(applyPracticeDay(s, addDays(D, -1))).toEqual(s);
    });

    it('does not change the state when lastPracticeDate is in the future', () => {
      const s = streak({ current: 4, longest: 4, lastPracticeDate: addDays(D, 3), restDays: 0, nextRestDayOn: addDays(D, 1) });

      expect(applyPracticeDay(s, D)).toEqual(s);
    });

    it('does not refill or spend rest days on clock skew', () => {
      const s = streak({ current: 4, longest: 4, lastPracticeDate: addDays(D, 3), restDays: 0, nextRestDayOn: addDays(D, 1) });

      expect(applyPracticeDay(s, D).restDays).toBe(0);
    });
  });

  describe('gap covered by rest days', () => {
    it('spends one rest day for a single missed day and keeps the streak', () => {
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 6) }),
        addDays(D, 2),
      );

      expect(s.current).toBe(6);
      expect(s.longest).toBe(6);
      expect(s.restDays).toBe(0);
      expect(s.covered).toEqual([addDays(D, 1)]);
      expect(s.lastPracticeDate).toBe(addDays(D, 2));
    });

    it('spends two rest days for a two-day gap and records both covered dates', () => {
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 2, nextRestDayOn: null }),
        addDays(D, 3),
      );

      expect(s.current).toBe(6);
      expect(s.restDays).toBe(0);
      expect(s.covered).toEqual([addDays(D, 1), addDays(D, 2)]);
    });

    it('covers a gap through the DST start', () => {
      const s = applyPracticeDay(
        streak({ current: 2, longest: 2, lastPracticeDate: '2026-03-07', restDays: 1, nextRestDayOn: '2026-03-20' }),
        '2026-03-09',
      );

      expect(s.current).toBe(3);
      expect(s.restDays).toBe(0);
      expect(s.covered).toEqual(['2026-03-08']);
    });

    it('covers a skipped date when travelling east', () => {
      const s = applyPracticeDay(
        streak({ current: 2, longest: 2, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 6) }),
        addDays(D, 2),
      );

      expect(s.current).toBe(3);
      expect(s.covered).toEqual([addDays(D, 1)]);
    });

    it('keeps the existing nextRestDayOn when spending while below the cap', () => {
      const next = addDays(D, 4);
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 2, nextRestDayOn: null }),
        addDays(D, 2),
      );
      const below = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 1, nextRestDayOn: next }),
        addDays(D, 2),
      );

      expect(s.nextRestDayOn).toBe(addDays(addDays(D, 2), 7));
      expect(below.nextRestDayOn).toBe(next);
    });

    it('sets nextRestDayOn to today plus 7 when spending at the cap', () => {
      const today = addDays(D, 2);
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: REST_DAY_CAP, nextRestDayOn: null }),
        today,
      );

      expect(s.restDays).toBe(1);
      expect(s.nextRestDayOn).toBe(addDays(today, 7));
    });

    it('refills a due rest day before spending it', () => {
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 1) }),
        addDays(D, 2),
      );

      expect(s.current).toBe(6);
      expect(s.restDays).toBe(0);
      expect(s.covered).toEqual([addDays(D, 1)]);
    });

    it('caps the covered list at the last 10 dates', () => {
      const covered = Array.from({ length: 10 }, (_, i) => addDays('2026-01-01', i));
      const today = addDays(D, 2);
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 6), covered }),
        today,
      );

      expect(s.covered).toHaveLength(10);
      expect(s.covered[0]).toBe(covered[1]);
      expect(s.covered[9]).toBe(addDays(D, 1));
    });
  });

  describe('gap not covered by rest days', () => {
    it('resets the streak to 1 when there is no rest day for a single missed day', () => {
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 6) }),
        addDays(D, 2),
      );

      expect(s.current).toBe(1);
      expect(s.restDays).toBe(0);
      expect(s.covered).toEqual([]);
    });

    it('resets the streak when the gap is larger than the rest days held', () => {
      const s = applyPracticeDay(
        streak({ current: 5, longest: 5, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 6) }),
        addDays(D, 3),
      );

      expect(s.current).toBe(1);
      expect(s.restDays).toBe(1);
      expect(s.covered).toEqual([]);
    });

    it('never reduces longest when the streak resets', () => {
      const s = applyPracticeDay(
        streak({ current: 2, longest: 9, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 6) }),
        addDays(D, 10),
      );

      expect(s.current).toBe(1);
      expect(s.longest).toBe(9);
    });
  });

  describe('midnight rollover and long absence', () => {
    it('treats a practice after a long absence as a fresh start', () => {
      const s = applyPracticeDay(
        streak({ current: 12, longest: 12, lastPracticeDate: D, restDays: 2, nextRestDayOn: null }),
        addDays(D, 60),
      );

      expect(s.current).toBe(1);
      expect(s.longest).toBe(12);
      expect(s.lastPracticeDate).toBe(addDays(D, 60));
    });
  });
});

describe('refillRestDays', () => {
  it('does nothing before the refill is due', () => {
    const s = streak({ current: 3, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 7) });

    expect(refillRestDays(s, addDays(D, 6))).toEqual(s);
  });

  it('grants one rest day on the due date and moves the next refill a week on', () => {
    const s = refillRestDays(
      streak({ lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7) }),
      addDays(D, 7),
    );

    expect(s.restDays).toBe(1);
    expect(s.nextRestDayOn).toBe(addDays(D, 14));
  });

  it('caps at 2 and clears nextRestDayOn after a long absence', () => {
    const s = refillRestDays(
      streak({ current: 4, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7) }),
      addDays(D, 60),
    );

    expect(s.restDays).toBe(REST_DAY_CAP);
    expect(s.nextRestDayOn).toBeNull();
  });

  it('grants only the rest day needed to reach the cap from one', () => {
    const s = refillRestDays(
      streak({ lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 7) }),
      addDays(D, 60),
    );

    expect(s.restDays).toBe(REST_DAY_CAP);
    expect(s.nextRestDayOn).toBeNull();
  });

  it('does nothing while at the cap', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: REST_DAY_CAP, nextRestDayOn: null });

    expect(refillRestDays(s, addDays(D, 30))).toEqual(s);
  });

  it('leaves the streak, the last practice date and covered dates alone', () => {
    const covered: DateKey[] = ['2026-01-01'];
    const s = refillRestDays(
      streak({ current: 4, longest: 6, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7), covered }),
      addDays(D, 7),
    );

    expect(s.current).toBe(4);
    expect(s.longest).toBe(6);
    expect(s.lastPracticeDate).toBe(D);
    expect(s.covered).toEqual(covered);
  });

  it('does not mutate its input', () => {
    const input = streak({ lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7) });
    const snapshot = structuredClone(input);

    refillRestDays(input, addDays(D, 7));

    expect(input).toEqual(snapshot);
  });
});

describe('effectiveStreak', () => {
  it('is 0 before any practice', () => {
    expect(effectiveStreak(initialStreak(D), D)).toBe(0);
  });

  it('shows current on the day of practice', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7) });

    expect(effectiveStreak(s, D)).toBe(4);
  });

  it('shows current when practised yesterday', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7) });

    expect(effectiveStreak(s, addDays(D, 1))).toBe(4);
  });

  it('shows current when a missed day is covered by a rest day', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 7) });

    expect(effectiveStreak(s, addDays(D, 2))).toBe(4);
  });

  it('shows 0 when a missed day has no rest day to cover it', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 0, nextRestDayOn: addDays(D, 7) });

    expect(effectiveStreak(s, addDays(D, 2))).toBe(0);
  });

  it('shows 0 when the gap is larger than the rest days held', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 7) });

    expect(effectiveStreak(s, addDays(D, 3))).toBe(0);
  });

  it('counts a rest day refilled as of today', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 2) });

    expect(effectiveStreak(s, addDays(D, 3))).toBe(4);
  });

  it('does not count a refill that is not yet due', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 4) });

    expect(effectiveStreak(s, addDays(D, 3))).toBe(0);
  });

  it('shows current when lastPracticeDate is in the future (clock skew)', () => {
    const s = streak({ current: 4, lastPracticeDate: addDays(D, 2), restDays: 0, nextRestDayOn: addDays(D, 9) });

    expect(effectiveStreak(s, D)).toBe(4);
  });

  it('does not mutate its input', () => {
    const s = streak({ current: 4, lastPracticeDate: D, restDays: 1, nextRestDayOn: addDays(D, 2) });
    const snapshot = structuredClone(s);

    effectiveStreak(s, addDays(D, 3));

    expect(s).toEqual(snapshot);
  });
});
