import type { BucketStat, CalibrationFormat } from './calibration.models';

export interface FrequencyLine {
  label: string;
  round: { n: number; hits: number };
  lifetime: { n: number; hits: number };
  /** Null until the group has at least 10 lifetime answers. */
  verdict: string | null;
}

interface Group {
  label: string;
  stops: readonly number[];
  midpoint: number;
}

const GROUPS: Record<CalibrationFormat, readonly Group[]> = {
  'two-way': [
    { label: 'At 90% or more', stops: [90, 100], midpoint: 95 },
    { label: 'Between 70% and 80%', stops: [70, 80], midpoint: 75 },
    { label: 'At 60% or less', stops: [50, 60], midpoint: 55 },
  ],
  'four-way': [
    { label: 'At 75% or more', stops: [75, 100], midpoint: 87 },
    { label: 'At 50%', stops: [50], midpoint: 50 },
    { label: 'At 25% or less', stops: [0, 25], midpoint: 12 },
  ],
};

const VERDICT_MIN_ANSWERS = 10;
const ABOUT_RIGHT_POINTS = 10;

function tally(
  buckets: readonly BucketStat[],
  stops: readonly number[],
): { n: number; hits: number } {
  let n = 0;
  let hits = 0;
  for (const b of buckets) {
    if (stops.includes(b.stop)) {
      n += b.n;
      hits += b.hits;
    }
  }
  return { n, hits };
}

/**
 * Natural-frequency lines for the three confidence groups. The round is shown as counts;
 * a verdict compares the lifetime hit rate with the group's midpoint, and only once the
 * group has enough lifetime answers to be meaningful.
 */
export function frequencyLines(
  format: CalibrationFormat,
  roundBuckets: readonly BucketStat[],
  lifetimeBuckets: readonly BucketStat[],
): FrequencyLine[] {
  return GROUPS[format].map((group) => {
    const round = tally(roundBuckets, group.stops);
    const lifetime = tally(lifetimeBuckets, group.stops);
    let verdict: string | null = null;
    if (lifetime.n >= VERDICT_MIN_ANSWERS) {
      const rate = (lifetime.hits / lifetime.n) * 100;
      const gap = rate - group.midpoint;
      verdict =
        Math.abs(gap) <= ABOUT_RIGHT_POINTS
          ? 'About right'
          : gap < 0
            ? 'Lower than your confidence'
            : 'Higher than your confidence';
    }
    return { label: group.label, round, lifetime, verdict };
  });
}
