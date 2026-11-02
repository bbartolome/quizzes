import { describe, expect, it } from 'vitest';
import type { BucketStat } from './calibration.models';
import { frequencyLines } from './frequency-lines';

function bucket(stop: number, n: number, hits: number): BucketStat {
  return { stop, n, hits, pct: n ? (hits / n) * 100 : null, lo: null, hi: null };
}

describe('frequencyLines', () => {
  it('groups two-way stops into high, medium and low with natural-frequency labels', () => {
    const round = [bucket(90, 2, 2), bucket(100, 1, 1), bucket(70, 1, 0), bucket(50, 2, 1)];
    const lines = frequencyLines('two-way', round, round);
    expect(lines.map((l) => l.label)).toEqual([
      'At 90% or more',
      'Between 70% and 80%',
      'At 60% or less',
    ]);
    expect(lines[0].round).toEqual({ n: 3, hits: 3 });
    expect(lines[1].round).toEqual({ n: 1, hits: 0 });
    expect(lines[2].round).toEqual({ n: 2, hits: 1 });
  });

  it('groups four-way stops into high, 50% and low', () => {
    const round = [bucket(75, 1, 1), bucket(50, 2, 1), bucket(0, 1, 0)];
    const lines = frequencyLines('four-way', round, round);
    expect(lines.map((l) => l.label)).toEqual(['At 75% or more', 'At 50%', 'At 25% or less']);
    expect(lines[2].round).toEqual({ n: 1, hits: 0 });
  });

  it('gives no verdict until a group has at least 10 lifetime answers', () => {
    const round = [bucket(90, 3, 3)];
    const lifetime = [bucket(90, 9, 9)];
    expect(frequencyLines('two-way', round, lifetime)[0].verdict).toBeNull();
  });

  it('compares the lifetime hit rate to the group midpoint once there are 10 answers', () => {
    const about = [bucket(90, 10, 9)]; // 90% vs midpoint 95: within 10 points
    const lower = [bucket(90, 10, 5)]; // 50% vs 95: below
    const higher = [bucket(50, 10, 10)]; // 100% vs 55: above
    expect(frequencyLines('two-way', [], about)[0].verdict).toBe('About right');
    expect(frequencyLines('two-way', [], lower)[0].verdict).toBe('Lower than your confidence');
    expect(frequencyLines('two-way', [], higher)[2].verdict).toBe('Higher than your confidence');
  });
});
