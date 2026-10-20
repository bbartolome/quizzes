import { describe, it, expect } from 'vitest';
import {
  answerBrier,
  bucketStats,
  flags,
  isConfident,
  isCorrect,
  meanBrier,
  meanConfidence,
  overconfidence,
  overconfidenceLabel,
  percentCorrect,
  reviewGroup,
  skillScore,
  wilson,
} from './scoring';
import { CalibrationAnswer, FourWayItem, TwoWayItem } from './calibration.models';

const source = { label: 'Source', url: 'https://example.com' };

const twoWay: TwoWayItem = {
  id: 'tw1',
  prompt: 'Which is bigger?',
  options: ['Alpha', 'Beta'],
  correct: 1,
  topic: 'science',
  fact: 'Beta is bigger.',
  source,
};

const fourWay: FourWayItem = {
  id: 'fw1',
  prompt: 'Which are true?',
  options: ['Alpha', 'Beta'],
  truth: [true, false],
  topic: 'history',
  facts: ['Alpha is true.', 'Beta is false.'],
  source,
};

function answer(confidence: number, correct: boolean, itemId = 'x'): CalibrationAnswer {
  return { itemId, pick: 0, confidence, correct };
}

/** `n` answers at `confidence`, the first `hits` of them correct. */
function answers(confidence: number, hits: number, n: number): CalibrationAnswer[] {
  return Array.from({ length: n }, (_, i) => answer(confidence, i < hits, `i${i}`));
}

describe('isCorrect', () => {
  it('two-way: matches the correct option index', () => {
    expect(isCorrect(twoWay, 1)).toBe(true);
    expect(isCorrect(twoWay, 0)).toBe(false);
  });

  it('four-way: only an exact elementwise match is correct', () => {
    expect(isCorrect(fourWay, [true, false])).toBe(true);
    expect(isCorrect(fourWay, [false, false])).toBe(false);
    expect(isCorrect(fourWay, [true, true])).toBe(false);
    expect(isCorrect(fourWay, [false, true])).toBe(false);
  });

  it('four-way: covers all four outcomes against another truth', () => {
    const bothTrue: FourWayItem = { ...fourWay, truth: [true, true] };
    expect(isCorrect(bothTrue, [true, true])).toBe(true);
    const neither: FourWayItem = { ...fourWay, truth: [false, false] };
    expect(isCorrect(neither, [false, false])).toBe(true);
    const onlyB: FourWayItem = { ...fourWay, truth: [false, true] };
    expect(isCorrect(onlyB, [false, true])).toBe(true);
  });
});

describe('answerBrier', () => {
  it('80% and right = 0.04', () => {
    expect(answerBrier(80, true)).toBeCloseTo(0.04, 10);
  });

  it('80% and wrong = 0.64', () => {
    expect(answerBrier(80, false)).toBeCloseTo(0.64, 10);
  });

  it('100% wrong = 1, 100% right = 0', () => {
    expect(answerBrier(100, false)).toBe(1);
    expect(answerBrier(100, true)).toBe(0);
  });
});

describe('meanBrier', () => {
  it('is null for an empty set', () => {
    expect(meanBrier([])).toBeNull();
  });

  it('averages the per-answer Brier', () => {
    expect(meanBrier([answer(80, true), answer(80, false)])).toBeCloseTo(0.34, 10);
  });
});

describe('skillScore (two-way)', () => {
  const skillOf = (set: CalibrationAnswer[]) => skillScore(meanBrier(set)!, 'two-way');

  it('calibrated at 70% scores 58', () => {
    expect(skillOf(answers(70, 7, 10))).toBe(58);
  });

  it('calibrated at 80% scores 68', () => {
    expect(skillOf(answers(80, 8, 10))).toBe(68);
  });

  it('calibrated at 90% scores 82', () => {
    expect(skillOf(answers(90, 9, 10))).toBe(82);
  });

  it('100% confidence but right 7 of 10 scores 40', () => {
    expect(skillOf(answers(100, 7, 10))).toBe(40);
  });

  it('100% confidence but right 5 of 10 scores 0', () => {
    expect(skillOf(answers(100, 5, 10))).toBe(0);
  });

  it('guessing Brier scores the chance rate and perfect scores 100', () => {
    expect(skillScore(0.25, 'two-way')).toBe(50);
    expect(skillScore(0, 'two-way')).toBe(100);
  });

  it('is not clamped below 0', () => {
    expect(skillOf(answers(100, 0, 10))).toBe(-100);
    expect(skillScore(1, 'two-way')).toBeLessThan(0);
  });
});

describe('skillScore (four-way)', () => {
  it('25% confidence answers right 1 of 4 score the chance rate, 25', () => {
    const set = answers(25, 1, 4);
    expect(skillScore(meanBrier(set)!, 'four-way')).toBe(25);
  });

  it('perfect scores 100', () => {
    expect(skillScore(0, 'four-way')).toBe(100);
  });
});

describe('meanConfidence and percentCorrect', () => {
  it('are null for an empty set', () => {
    expect(meanConfidence([])).toBeNull();
    expect(percentCorrect([])).toBeNull();
  });

  it('average confidence and share correct on a 0–100 scale', () => {
    const set = [answer(60, true), answer(80, true), answer(100, false), answer(60, false)];
    expect(meanConfidence(set)).toBe(75);
    expect(percentCorrect(set)).toBe(50);
  });
});

describe('overconfidence', () => {
  it('is null for an empty set', () => {
    expect(overconfidence([])).toBeNull();
  });

  it('is mean confidence minus percent correct, unrounded', () => {
    expect(overconfidence(answers(90, 8, 10))).toBeCloseTo(10, 10);
    expect(overconfidence(answers(70, 8, 10))).toBeCloseTo(-10, 10);
    expect(overconfidence(answers(75, 7, 9))).toBeCloseTo(75 - 700 / 9, 10);
  });
});

describe('overconfidenceLabel', () => {
  it('reads "well calibrated" within ±2', () => {
    expect(overconfidenceLabel(0)).toBe('well calibrated');
    expect(overconfidenceLabel(2)).toBe('well calibrated');
    expect(overconfidenceLabel(-2)).toBe('well calibrated');
  });

  it('reads N points overconfident above 2', () => {
    expect(overconfidenceLabel(12)).toBe('12 points overconfident');
    expect(overconfidenceLabel(2.4 + 0.2)).toBe('3 points overconfident');
  });

  it('reads N points underconfident below -2', () => {
    expect(overconfidenceLabel(-8)).toBe('8 points underconfident');
  });
});

describe('wilson', () => {
  it('is null when n = 0', () => {
    expect(wilson(0, 0)).toBeNull();
  });

  it('5 of 10 gives roughly 23.7–76.3', () => {
    const w = wilson(5, 10)!;
    expect(w.lo).toBeCloseTo(23.7, 1);
    expect(w.hi).toBeCloseTo(76.3, 1);
  });

  it('stays within 0–100 at the extremes', () => {
    const none = wilson(0, 10)!;
    expect(none.lo).toBeGreaterThanOrEqual(0);
    expect(none.hi).toBeLessThanOrEqual(100);
    const all = wilson(10, 10)!;
    expect(all.lo).toBeGreaterThanOrEqual(0);
    expect(all.hi).toBeLessThanOrEqual(100);
    expect(all.hi).toBeGreaterThan(all.lo);
  });
});

describe('bucketStats', () => {
  it('returns one bucket per two-way stop, in order, with empty ones null', () => {
    const buckets = bucketStats(
      [answer(70, true), answer(70, false), answer(70, true), answer(100, true)],
      'two-way',
    );
    expect(buckets.map((b) => b.stop)).toEqual([50, 60, 70, 80, 90, 100]);
    expect(buckets.map((b) => b.n)).toEqual([0, 0, 3, 0, 0, 1]);

    const empty = buckets[0];
    expect(empty.hits).toBe(0);
    expect(empty.pct).toBeNull();
    expect(empty.lo).toBeNull();
    expect(empty.hi).toBeNull();

    const seventy = buckets[2];
    expect(seventy.hits).toBe(2);
    expect(seventy.pct).toBeCloseTo(66.67, 1);
    expect(seventy.lo).not.toBeNull();
    expect(seventy.hi).not.toBeNull();
    expect(seventy.lo!).toBeLessThan(seventy.pct!);
    expect(seventy.hi!).toBeGreaterThan(seventy.pct!);

    expect(buckets[5].pct).toBe(100);
  });

  it('returns one bucket per four-way stop, in order', () => {
    const buckets = bucketStats(
      [answer(0, false), answer(25, true), answer(25, false)],
      'four-way',
    );
    expect(buckets.map((b) => b.stop)).toEqual([0, 25, 50, 75, 100]);
    expect(buckets.map((b) => b.n)).toEqual([1, 2, 0, 0, 0]);
    expect(buckets[1].pct).toBe(50);
    expect(buckets[2].pct).toBeNull();
  });

  it('gives all-empty buckets for no answers', () => {
    const buckets = bucketStats([], 'two-way');
    expect(buckets).toHaveLength(6);
    expect(buckets.every((b) => b.n === 0 && b.pct === null)).toBe(true);
  });
});

describe('isConfident', () => {
  it('two-way: 90 and 100 only', () => {
    expect(isConfident(answer(80, true), 'two-way')).toBe(false);
    expect(isConfident(answer(90, true), 'two-way')).toBe(true);
    expect(isConfident(answer(100, true), 'two-way')).toBe(true);
  });

  it('four-way: 75 and 100 only', () => {
    expect(isConfident(answer(50, true), 'four-way')).toBe(false);
    expect(isConfident(answer(75, true), 'four-way')).toBe(true);
    expect(isConfident(answer(100, true), 'four-way')).toBe(true);
  });
});

describe('reviewGroup', () => {
  it('confident wrong is a confident-miss', () => {
    expect(reviewGroup(answer(90, false), 'two-way')).toBe('confident-miss');
  });

  it('hedged wrong is a hedged-miss', () => {
    expect(reviewGroup(answer(60, false), 'two-way')).toBe('hedged-miss');
  });

  it('hedged right is an underplayed-hit', () => {
    expect(reviewGroup(answer(60, true), 'two-way')).toBe('underplayed-hit');
  });

  it('confident right is a confident-hit', () => {
    expect(reviewGroup(answer(100, true), 'two-way')).toBe('confident-hit');
  });

  it('uses the four-way confident stops', () => {
    expect(reviewGroup(answer(75, false), 'four-way')).toBe('confident-miss');
    expect(reviewGroup(answer(75, true), 'four-way')).toBe('confident-hit');
    expect(reviewGroup(answer(50, false), 'four-way')).toBe('hedged-miss');
    expect(reviewGroup(answer(25, true), 'four-way')).toBe('underplayed-hit');
  });
});

describe('flags', () => {
  it('flags a miss at 100 on both formats', () => {
    expect(flags(answer(100, false), 'two-way')).toContain('miss-at-100');
    expect(flags(answer(100, false), 'four-way')).toContain('miss-at-100');
  });

  it('does not flag a hit at 100 or a miss below 100', () => {
    expect(flags(answer(100, true), 'two-way')).toEqual([]);
    expect(flags(answer(90, false), 'two-way')).toEqual([]);
    expect(flags(answer(75, false), 'four-way')).toEqual([]);
  });

  it('flags 0% on four-way as below-chance', () => {
    expect(flags(answer(0, false), 'four-way')).toContain('below-chance');
  });

  it('does not flag other four-way confidences as below-chance', () => {
    expect(flags(answer(25, false), 'four-way')).not.toContain('below-chance');
    expect(flags(answer(50, false), 'four-way')).not.toContain('below-chance');
  });

  it('never flags below-chance on two-way', () => {
    for (const stop of [50, 60, 70, 80, 90, 100]) {
      expect(flags(answer(stop, false), 'two-way')).not.toContain('below-chance');
    }
  });
});
