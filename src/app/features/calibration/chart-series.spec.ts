import { describe, it, expect } from 'vitest';
import { seriesBars, seriesPoints, seriesSegments } from './chart-series';
import { DEFAULT_BOX, xFor, yFor } from './chart-scales';
import { BucketStat } from './calibration.models';

const empty = (stop: number): BucketStat => ({
  stop,
  n: 0,
  hits: 0,
  pct: null,
  lo: null,
  hi: null,
});
const bucket = (stop: number, n: number, hits: number, lo: number, hi: number): BucketStat => ({
  stop,
  n,
  hits,
  pct: (hits / n) * 100,
  lo,
  hi,
});

const stops = [50, 60, 70, 80, 90, 100];

describe('chart-series (two-way)', () => {
  it('produces no point for an empty bucket', () => {
    const buckets = stops.map(empty);
    expect(seriesPoints('two-way', buckets, DEFAULT_BOX)).toEqual([]);
  });

  it('places a point with x, y, n and hits', () => {
    const buckets = stops.map((s) => (s === 70 ? bucket(70, 10, 7, 40, 90) : empty(s)));
    const [point] = seriesPoints('two-way', buckets, DEFAULT_BOX);
    expect(point).toEqual({
      stop: 70,
      x: xFor(70, 'two-way', DEFAULT_BOX),
      y: yFor(70, DEFAULT_BOX),
      n: 10,
      hits: 7,
    });
  });

  it('shifts x by dx', () => {
    const buckets = stops.map((s) => (s === 80 ? bucket(80, 4, 3, 30, 95) : empty(s)));
    const [point] = seriesPoints('two-way', buckets, DEFAULT_BOX, 4);
    expect(point.x).toBe(xFor(80, 'two-way', DEFAULT_BOX) + 4);
  });

  it('draws a vertical bar from hi to lo at the point x and skips empty buckets', () => {
    const buckets = stops.map((s) => (s === 60 ? bucket(60, 5, 3, 30, 85) : empty(s)));
    const bars = seriesBars('two-way', buckets, DEFAULT_BOX);
    const x = xFor(60, 'two-way', DEFAULT_BOX);
    expect(bars).toEqual([{ x1: x, y1: yFor(85, DEFAULT_BOX), x2: x, y2: yFor(30, DEFAULT_BOX) }]);
  });

  it('joins two adjacent non-empty buckets with one segment', () => {
    const buckets = stops.map((s) =>
      s === 70 ? bucket(70, 6, 4, 30, 90) : s === 80 ? bucket(80, 8, 7, 50, 98) : empty(s),
    );
    const segments = seriesSegments('two-way', buckets, DEFAULT_BOX);
    expect(segments).toEqual([
      {
        x1: xFor(70, 'two-way', DEFAULT_BOX),
        y1: yFor((4 / 6) * 100, DEFAULT_BOX),
        x2: xFor(80, 'two-way', DEFAULT_BOX),
        y2: yFor((7 / 8) * 100, DEFAULT_BOX),
      },
    ]);
  });

  it('draws no segment across an empty middle bucket', () => {
    const buckets = stops.map((s) => (s === 60 || s === 80 ? bucket(s, 5, 4, 40, 95) : empty(s)));
    expect(seriesSegments('two-way', buckets, DEFAULT_BOX)).toEqual([]);
  });

  it('shifts segments by dx', () => {
    const buckets = stops.map((s) => (s === 50 || s === 60 ? bucket(s, 5, 3, 30, 85) : empty(s)));
    const [segment] = seriesSegments('two-way', buckets, DEFAULT_BOX, 4);
    expect(segment.x1).toBe(xFor(50, 'two-way', DEFAULT_BOX) + 4);
    expect(segment.x2).toBe(xFor(60, 'two-way', DEFAULT_BOX) + 4);
  });
});
