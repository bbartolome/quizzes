import { describe, it, expect } from 'vitest';
import { chartGeometry } from './chart-geometry';
import { DEFAULT_BOX, xTicks, yTicks } from './chart-scales';
import { seriesBars, seriesPoints, seriesSegments } from './chart-series';
import { chanceLine, diagonal, flagRings, regions } from './chart-regions';
import { FORMATS } from './calibration-format';
import { BucketStat, CalibrationFormat } from './calibration.models';

const bucket = (stop: number, n: number, hits: number): BucketStat => ({
  stop,
  n,
  hits,
  pct: n ? (hits / n) * 100 : null,
  lo: n ? Math.max(0, (hits / n) * 100 - 10) : null,
  hi: n ? Math.min(100, (hits / n) * 100 + 10) : null,
});

const bucketsFor = (format: CalibrationFormat): BucketStat[] =>
  FORMATS[format].stops.map((stop, i) => (i === 2 ? bucket(stop, 0, 0) : bucket(stop, 10, 5 + (i % 4))));

describe('chartGeometry', () => {
  for (const format of ['two-way', 'four-way'] as const) {
    describe(format, () => {
      const buckets = bucketsFor(format);
      const geometry = chartGeometry(format, buckets);

      it('composes ticks from the scale functions', () => {
        expect(geometry.xTicks).toEqual(xTicks(format, buckets, DEFAULT_BOX));
        expect(geometry.yTicks).toEqual(yTicks(DEFAULT_BOX));
      });

      it('composes points, bars and segments from the series functions', () => {
        expect(geometry.points).toEqual(seriesPoints(format, buckets, DEFAULT_BOX));
        expect(geometry.bars).toEqual(seriesBars(format, buckets, DEFAULT_BOX));
        expect(geometry.segments).toEqual(seriesSegments(format, buckets, DEFAULT_BOX));
      });

      it('composes guides and regions from the region functions', () => {
        const { overRegion, underRegion } = regions(format, DEFAULT_BOX);
        expect(geometry.diagonal).toEqual(diagonal(format, DEFAULT_BOX));
        expect(geometry.chanceLine).toEqual(chanceLine(format, DEFAULT_BOX));
        expect(geometry.overRegion).toBe(overRegion);
        expect(geometry.underRegion).toBe(underRegion);
        expect(geometry.flagRings).toEqual(flagRings(format, geometry.points));
      });

      it('has empty overlay output when overlay is null', () => {
        expect(geometry.overlayPoints).toEqual([]);
        expect(geometry.overlaySegments).toEqual([]);
        expect(chartGeometry(format, buckets, null).overlayPoints).toEqual([]);
      });

      it('offsets overlay points and segments by 4', () => {
        const overlay = FORMATS[format].stops.map((stop, i) => bucket(stop, 4, i % 5));
        const withOverlay = chartGeometry(format, buckets, overlay);
        expect(withOverlay.overlayPoints).toEqual(seriesPoints(format, overlay, DEFAULT_BOX, 4));
        expect(withOverlay.overlaySegments).toEqual(seriesSegments(format, overlay, DEFAULT_BOX, 4));
        expect(withOverlay.points).toEqual(geometry.points);
      });
    });
  }

  it('honours a custom box', () => {
    const box = { width: 200, height: 100, pad: { top: 5, right: 5, bottom: 20, left: 20 } };
    const buckets = bucketsFor('two-way');
    const geometry = chartGeometry('two-way', buckets, null, box);
    expect(geometry.points).toEqual(seriesPoints('two-way', buckets, box));
    expect(geometry.diagonal).toEqual(diagonal('two-way', box));
  });
});
