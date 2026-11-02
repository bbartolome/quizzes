import { describe, it, expect } from 'vitest';
import {
  CROSS_QUIZ_BADGES,
  KNOWS_WHAT_IT_KNOWS,
  NAMES_THE_TRAP,
  NOTICES_LOOKALIKES,
  SURE_MEANS_SURE,
  earnedBadges,
} from './badges';
import type { BadgeContext, MasteryState } from '../models/practice.models';
import type { CalibrationFormat, ConfusedPair } from '../models/quiz.models';

type Entry = { confidence: number; correct: boolean; format: CalibrationFormat };

function mastery(entries: Record<string, MasteryState>): ReadonlyMap<string, MasteryState> {
  return new Map(Object.entries(entries));
}

/** Sixteen knowledge-base concepts, the first `practised` of them in the given state. */
function traps(practised: number, state: MasteryState = 'practised'): ReadonlyMap<string, MasteryState> {
  const entries: Record<string, MasteryState> = {};
  for (let i = 0; i < 16; i++) {
    entries[`trap-${i}`] = i < practised ? state : 'learning';
  }
  return mastery(entries);
}

function ctx(partial: Partial<BadgeContext> = {}): BadgeContext {
  return { mastery: new Map(), pairs: [], calibration: [], extra: {}, ...partial };
}

/** `correct` hits and `wrong` misses at one confidence stop in one format. */
function answers(
  confidence: number,
  format: CalibrationFormat,
  correct: number,
  wrong = 0,
): Entry[] {
  return [
    ...Array.from({ length: correct }, () => ({ confidence, correct: true, format })),
    ...Array.from({ length: wrong }, () => ({ confidence, correct: false, format })),
  ];
}

/** Two-way mid-band answers (70%) that count toward the total but to neither group. */
function midTwoWay(n: number): Entry[] {
  return answers(70, 'two-way', n);
}

describe('cross-quiz badge definitions', () => {
  it('registers the four spec ids in order', () => {
    expect(CROSS_QUIZ_BADGES.map((b) => b.id)).toEqual([
      'notices-lookalikes',
      'names-the-trap',
      'knows-what-it-knows',
      'sure-means-sure',
    ]);
  });

  it('gives every badge a title, insight and criterion', () => {
    for (const badge of CROSS_QUIZ_BADGES) {
      expect(badge.title.length).toBeGreaterThan(0);
      expect(badge.insight.length).toBeGreaterThan(0);
      expect(badge.criterion.length).toBeGreaterThan(0);
    }
  });

  it('exports the four definitions individually', () => {
    expect(NOTICES_LOOKALIKES.id).toBe('notices-lookalikes');
    expect(NAMES_THE_TRAP.id).toBe('names-the-trap');
    expect(KNOWS_WHAT_IT_KNOWS.id).toBe('knows-what-it-knows');
    expect(SURE_MEANS_SURE.id).toBe('sure-means-sure');
  });
});

describe('earnedBadges', () => {
  it('returns no ids for an empty context', () => {
    expect(earnedBadges(CROSS_QUIZ_BADGES, ctx())).toEqual([]);
  });

  it('returns the earned ids in definition order', () => {
    const everything = ctx({
      mastery: traps(16),
      pairs: [{ concepts: ['trap-0', 'trap-1'] }],
      calibration: [...answers(100, 'two-way', 20), ...answers(50, 'two-way', 10)],
    });
    // Knows-what-it-knows is not earned: high and low hit rates are both 100%, gap 0.
    const ids = earnedBadges(CROSS_QUIZ_BADGES, everything);
    expect(ids).toEqual(['notices-lookalikes', 'names-the-trap', 'sure-means-sure']);
  });

  it('returns an empty list when no defs are given', () => {
    expect(earnedBadges([], ctx({ mastery: traps(16) }))).toEqual([]);
  });
});

describe('notices-lookalikes', () => {
  const pair: ConfusedPair = { concepts: ['trap-0', 'trap-1'] };

  it('is not earned without any confused pair', () => {
    expect(NOTICES_LOOKALIKES.earned(ctx({ mastery: traps(16) }))).toBe(false);
  });

  it('is earned when both concepts of a pair are practised', () => {
    const c = ctx({ mastery: mastery({ 'trap-0': 'practised', 'trap-1': 'practised' }), pairs: [pair] });
    expect(NOTICES_LOOKALIKES.earned(c)).toBe(true);
  });

  it('counts mastered as well as practised', () => {
    const c = ctx({ mastery: mastery({ 'trap-0': 'mastered', 'trap-1': 'practised' }), pairs: [pair] });
    expect(NOTICES_LOOKALIKES.earned(c)).toBe(true);
  });

  it('is not earned when one side is only learning', () => {
    const c = ctx({ mastery: mastery({ 'trap-0': 'practised', 'trap-1': 'learning' }), pairs: [pair] });
    expect(NOTICES_LOOKALIKES.earned(c)).toBe(false);
  });

  it('is not earned when one side is new or missing', () => {
    expect(
      NOTICES_LOOKALIKES.earned(ctx({ mastery: mastery({ 'trap-0': 'practised', 'trap-1': 'new' }), pairs: [pair] })),
    ).toBe(false);
    expect(
      NOTICES_LOOKALIKES.earned(ctx({ mastery: mastery({ 'trap-0': 'practised' }), pairs: [pair] })),
    ).toBe(false);
  });

  it('is earned when any one of several pairs qualifies', () => {
    const c = ctx({
      mastery: mastery({ 'trap-0': 'learning', 'trap-1': 'learning', 'trap-2': 'mastered', 'trap-3': 'practised' }),
      pairs: [{ concepts: ['trap-0', 'trap-1'] }, { concepts: ['trap-2', 'trap-3'] }],
    });
    expect(NOTICES_LOOKALIKES.earned(c)).toBe(true);
  });
});

describe('names-the-trap', () => {
  it('is not earned at 7 of 16 practised', () => {
    expect(NAMES_THE_TRAP.earned(ctx({ mastery: traps(7) }))).toBe(false);
  });

  it('is earned at exactly 8 of 16 practised', () => {
    expect(NAMES_THE_TRAP.earned(ctx({ mastery: traps(8) }))).toBe(true);
  });

  it('is earned at 16 of 16 practised', () => {
    expect(NAMES_THE_TRAP.earned(ctx({ mastery: traps(16) }))).toBe(true);
  });

  it('counts mastered concepts toward the 8', () => {
    const c = ctx({
      mastery: mastery({
        ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`trap-${i}`, 'practised'])),
        ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`trap-${i + 4}`, 'mastered'])),
      }),
    });
    expect(NAMES_THE_TRAP.earned(c)).toBe(true);
  });

  it('does not count learning or new concepts', () => {
    const c = ctx({
      mastery: mastery({
        ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`trap-${i}`, 'practised'])),
        ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`trap-${i + 7}`, 'learning'])),
        'trap-15': 'new',
      }),
    });
    expect(NAMES_THE_TRAP.earned(c)).toBe(false);
  });

  it('is not earned with an empty mastery map', () => {
    expect(NAMES_THE_TRAP.earned(ctx())).toBe(false);
  });
});

describe('knows-what-it-knows', () => {
  // Thresholds: two-way high >= 80, low <= 60; four-way high >= 75, low <= 25.

  it('needs at least 30 lifetime answers', () => {
    const base = [...answers(80, 'two-way', 8), ...answers(60, 'two-way', 0, 8)];
    // 16 answers in the two groups with a 100-point gap: still short of 30.
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: [...base, ...midTwoWay(13)] }))).toBe(false); // 29
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: [...base, ...midTwoWay(14)] }))).toBe(true); // 30
  });

  it('needs at least 8 answers in the high group', () => {
    const c = [...answers(80, 'two-way', 7), ...answers(60, 'two-way', 0, 8), ...midTwoWay(20)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(false);
  });

  it('needs at least 8 answers in the low group', () => {
    const c = [...answers(80, 'two-way', 8), ...answers(60, 'two-way', 0, 7), ...midTwoWay(20)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(false);
  });

  it('is earned at exactly 8 per group with a 100-point gap', () => {
    const c = [...answers(80, 'two-way', 8), ...answers(60, 'two-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(true);
  });

  it('is earned at a 20-point gap exactly', () => {
    // high 60/100 = 60%, low 40/100 = 40%: gap is exactly 20 points.
    const c = [...answers(90, 'two-way', 60, 40), ...answers(50, 'two-way', 40, 60)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(true);
  });

  it('is not earned at a 19-point gap', () => {
    // high 59/100 = 59%, low 40/100 = 40%: gap is 19 points.
    const c = [...answers(90, 'two-way', 59, 41), ...answers(50, 'two-way', 40, 60)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(false);
  });

  it('is not earned when the high group is worse than the low group', () => {
    const c = [...answers(90, 'two-way', 2, 8), ...answers(50, 'two-way', 8, 2), ...midTwoWay(10)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(false);
  });

  it('treats two-way 79 as neither, so it does not join the high group', () => {
    // High @80 is 4/8 (50%), low @60 is 2/8 (25%): gap 25, earned.
    // If 79 were counted as high, eight wrong 79s would drop the high rate to 4/16 (25%), gap 0.
    const c = [
      ...answers(80, 'two-way', 4, 4),
      ...answers(60, 'two-way', 2, 6),
      ...answers(79, 'two-way', 0, 8),
      ...midTwoWay(6),
    ];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(true);
  });

  it('treats two-way 60 as low and 61 as neither', () => {
    const only61 = [...answers(80, 'two-way', 8), ...answers(61, 'two-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: only61 }))).toBe(false);
    const at60 = [...answers(80, 'two-way', 8), ...answers(60, 'two-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: at60 }))).toBe(true);
  });

  it('uses four-way 75 as high and 74 as neither', () => {
    const at74 = [...answers(74, 'four-way', 8), ...answers(25, 'four-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: at74 }))).toBe(false);
    const at75 = [...answers(75, 'four-way', 8), ...answers(25, 'four-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: at75 }))).toBe(true);
  });

  it('uses four-way 25 as low and 26 as neither', () => {
    const at26 = [...answers(75, 'four-way', 8), ...answers(26, 'four-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: at26 }))).toBe(false);
    const at25 = [...answers(75, 'four-way', 8), ...answers(25, 'four-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: at25 }))).toBe(true);
  });

  it('does not count two-way 75 as high (two-way high starts at 80)', () => {
    const c = [...answers(75, 'two-way', 8), ...answers(25, 'two-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(false);
  });

  it('does not count four-way 60 as low (four-way low ends at 25)', () => {
    const c = [...answers(80, 'two-way', 8), ...answers(60, 'four-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(false);
  });

  it('pools formats: two-way high against four-way low', () => {
    const c = [...answers(80, 'two-way', 8), ...answers(25, 'four-way', 0, 8), ...midTwoWay(14)];
    expect(KNOWS_WHAT_IT_KNOWS.earned(ctx({ calibration: c }))).toBe(true);
  });
});

describe('sure-means-sure', () => {
  it('is not earned with 19 answers at 90 or above, all correct', () => {
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(90, 'two-way', 19) }))).toBe(false);
  });

  it('is earned with exactly 20 answers at 90 or above, all correct', () => {
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(90, 'two-way', 20) }))).toBe(true);
  });

  it('is earned at exactly 85% hit rate (17 of 20)', () => {
    const c = [...answers(100, 'two-way', 17, 3)];
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: c }))).toBe(true);
  });

  it('is not earned at 84% (16 of 19 is below 85%)', () => {
    // 16/19 = 84.2%, below 85%.
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(90, 'two-way', 16, 3) }))).toBe(false);
  });

  it('is not earned at 80% (16 of 20)', () => {
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(90, 'two-way', 16, 4) }))).toBe(false);
  });

  it('counts 90 and 100 but not 89', () => {
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(89, 'two-way', 20) }))).toBe(false);
    const mixed = [...answers(90, 'two-way', 10), ...answers(100, 'two-way', 10)];
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: mixed }))).toBe(true);
  });

  it('measures the hit rate only over the high-confidence answers', () => {
    const c = [...answers(90, 'two-way', 20), ...answers(50, 'two-way', 0, 40)];
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: c }))).toBe(true);
  });

  it('counts four-way answers at 100 but not four-way 75', () => {
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(100, 'four-way', 20) }))).toBe(true);
    expect(SURE_MEANS_SURE.earned(ctx({ calibration: answers(75, 'four-way', 20) }))).toBe(false);
  });
});
