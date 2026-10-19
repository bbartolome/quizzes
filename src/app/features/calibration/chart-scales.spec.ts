import { describe, expect, it } from 'vitest';
import { BucketStat } from './calibration.models';
import { DEFAULT_BOX, xFor, xTicks, yFor, yTicks } from './chart-scales';

const { width, height, pad } = DEFAULT_BOX;

function bucket(stop: number, n: number): BucketStat {
  return { stop, n, hits: 0, pct: null, lo: null, hi: null };
}

describe('xFor', () => {
  it('maps the two-way axis 50–100 onto the plot width', () => {
    expect(xFor(50, 'two-way')).toBe(pad.left);
    expect(xFor(100, 'two-way')).toBe(width - pad.right);
  });

  it('maps the four-way axis 0–100 onto the plot width', () => {
    expect(xFor(0, 'four-way')).toBe(pad.left);
    expect(xFor(100, 'four-way')).toBe(width - pad.right);
  });

  it('is linear between the ends', () => {
    expect(xFor(75, 'two-way')).toBeCloseTo((pad.left + width - pad.right) / 2);
    expect(xFor(50, 'four-way')).toBeCloseTo((pad.left + width - pad.right) / 2);
  });

  it('honours a custom box', () => {
    const box = { width: 200, height: 100, pad: { top: 0, right: 10, bottom: 0, left: 20 } };
    expect(xFor(50, 'two-way', box)).toBe(20);
    expect(xFor(100, 'two-way', box)).toBe(190);
  });
});

describe('yFor', () => {
  it('puts 0 at the bottom of the plot and 100 at the top', () => {
    expect(yFor(0)).toBe(height - pad.bottom);
    expect(yFor(100)).toBe(pad.top);
  });

  it('is linear between the ends', () => {
    expect(yFor(50)).toBeCloseTo((pad.top + height - pad.bottom) / 2);
  });
});

describe('xTicks', () => {
  it('keeps one tick per bucket, carrying n', () => {
    const buckets = [bucket(50, 3), bucket(60, 0), bucket(70, 5), bucket(80, 0), bucket(90, 1), bucket(100, 2)];
    const ticks = xTicks('two-way', buckets);
    expect(ticks.map((t) => t.stop)).toEqual([50, 60, 70, 80, 90, 100]);
    expect(ticks.map((t) => t.n)).toEqual([3, 0, 5, 0, 1, 2]);
    expect(ticks[0].x).toBe(xFor(50, 'two-way'));
    expect(ticks[5].x).toBe(xFor(100, 'two-way'));
  });

  it('uses the four-way axis for four-way buckets', () => {
    const ticks = xTicks('four-way', [bucket(0, 1), bucket(25, 2)]);
    expect(ticks.map((t) => t.x)).toEqual([xFor(0, 'four-way'), xFor(25, 'four-way')]);
  });
});

describe('yTicks', () => {
  it('lists 0, 25, 50, 75, 100 with matching y positions', () => {
    const ticks = yTicks();
    expect(ticks.map((t) => t.value)).toEqual([0, 25, 50, 75, 100]);
    expect(ticks.map((t) => t.y)).toEqual([0, 25, 50, 75, 100].map((v) => yFor(v)));
  });
});
