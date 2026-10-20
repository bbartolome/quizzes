import { describe, it, expect } from 'vitest';
import { chanceLine, diagonal, flagRings, regions } from './chart-regions';
import { ChartPoint } from './chart-series';
import { DEFAULT_BOX, xFor, yFor } from './chart-scales';
import { CalibrationFormat } from './calibration.models';

const point = (format: CalibrationFormat, stop: number, n: number, hits: number): ChartPoint => ({
  stop,
  x: xFor(stop, format),
  y: yFor((hits / n) * 100),
  n,
  hits,
});

const parse = (polygon: string): [number, number][] =>
  polygon
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return [x, y];
    });

describe('diagonal', () => {
  it.each([
    ['two-way', 50],
    ['four-way', 0],
  ] as const)('runs from axis minimum to 100 (%s)', (format, axisMin) => {
    expect(diagonal(format)).toEqual({
      x1: xFor(axisMin, format),
      y1: yFor(axisMin),
      x2: xFor(100, format),
      y2: yFor(100),
    });
  });
});

describe('chanceLine', () => {
  it.each([
    ['two-way', 50],
    ['four-way', 25],
  ] as const)('is horizontal at the chance level (%s)', (format, chance) => {
    const line = chanceLine(format);
    expect(line.y1).toBe(yFor(chance));
    expect(line.y2).toBe(yFor(chance));
    expect(line.x1).toBe(DEFAULT_BOX.pad.left);
    expect(line.x2).toBe(DEFAULT_BOX.width - DEFAULT_BOX.pad.right);
  });
});

describe('regions', () => {
  it.each(['two-way', 'four-way'] as const)('returns two polygons of x,y pairs (%s)', (format) => {
    const { overRegion, underRegion } = regions(format);
    for (const polygon of [overRegion, underRegion]) {
      expect(polygon).toMatch(/^-?[\d.]+,-?[\d.]+( -?[\d.]+,-?[\d.]+)+$/);
      expect(parse(polygon).length).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(['two-way', 'four-way'] as const)(
    'overRegion holds the bottom-right corner, underRegion the top-left (%s)',
    (format) => {
      const { overRegion, underRegion } = regions(format);
      const right = DEFAULT_BOX.width - DEFAULT_BOX.pad.right;
      const bottom = DEFAULT_BOX.height - DEFAULT_BOX.pad.bottom;
      const has = (polygon: string, x: number, y: number) =>
        parse(polygon).some(([px, py]) => px === x && py === y);
      expect(has(overRegion, right, bottom)).toBe(true);
      expect(has(underRegion, DEFAULT_BOX.pad.left, DEFAULT_BOX.pad.top)).toBe(true);
    },
  );
});

describe('flagRings', () => {
  it('flags a stop-100 point with hits below n', () => {
    const p = point('two-way', 100, 5, 4);
    expect(flagRings('two-way', [p])).toEqual([{ x: p.x, y: p.y }]);
  });

  it('does not flag a stop-100 point with every hit', () => {
    expect(flagRings('two-way', [point('two-way', 100, 5, 5)])).toEqual([]);
  });

  it('flags a four-way stop-0 point with answers', () => {
    const p = point('four-way', 0, 3, 1);
    expect(flagRings('four-way', [p])).toEqual([{ x: p.x, y: p.y }]);
  });

  it('never flags stop 0 on two-way', () => {
    expect(flagRings('two-way', [point('two-way', 0, 3, 1)])).toEqual([]);
  });

  it('does not flag middle stops', () => {
    expect(flagRings('four-way', [point('four-way', 50, 4, 1)])).toEqual([]);
  });
});
