import { ChartBox, DEFAULT_BOX, Line, xFor, yFor } from './chart-scales';
import { BucketStat, CalibrationFormat } from './calibration.models';

export interface ChartPoint {
  stop: number;
  x: number;
  y: number;
  n: number;
  hits: number;
}

export function seriesPoints(
  format: CalibrationFormat,
  buckets: BucketStat[],
  box: ChartBox = DEFAULT_BOX,
  dx = 0,
): ChartPoint[] {
  return buckets
    .filter((b) => b.n > 0)
    .map((b) => ({
      stop: b.stop,
      x: xFor(b.stop, format, box) + dx,
      y: yFor(b.pct!, box),
      n: b.n,
      hits: b.hits,
    }));
}

export function seriesBars(
  format: CalibrationFormat,
  buckets: BucketStat[],
  box: ChartBox = DEFAULT_BOX,
): Line[] {
  return buckets
    .filter((b) => b.n > 0)
    .map((b) => ({
      x1: xFor(b.stop, format, box),
      y1: yFor(b.hi!, box),
      x2: xFor(b.stop, format, box),
      y2: yFor(b.lo!, box),
    }));
}

export function seriesSegments(
  format: CalibrationFormat,
  buckets: BucketStat[],
  box: ChartBox = DEFAULT_BOX,
  dx = 0,
): Line[] {
  const lines: Line[] = [];
  for (let i = 1; i < buckets.length; i++) {
    const a = buckets[i - 1];
    const b = buckets[i];
    if (a.n > 0 && b.n > 0) {
      lines.push({
        x1: xFor(a.stop, format, box) + dx,
        y1: yFor(a.pct!, box),
        x2: xFor(b.stop, format, box) + dx,
        y2: yFor(b.pct!, box),
      });
    }
  }
  return lines;
}
