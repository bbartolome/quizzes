import { FORMATS } from './calibration-format';
import type { BucketStat, CalibrationFormat } from './calibration.models';

export interface ChartBox {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

export const DEFAULT_BOX: ChartBox = {
  width: 320,
  height: 240,
  pad: { top: 12, right: 12, bottom: 36, left: 36 },
};

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Pixel x for a confidence stop, mapped from the format's axis range. */
export function xFor(stop: number, format: CalibrationFormat, box: ChartBox = DEFAULT_BOX): number {
  const [min, max] = FORMATS[format].axis;
  return box.pad.left + ((stop - min) / (max - min)) * (box.width - box.pad.left - box.pad.right);
}

/** Pixel y for an accuracy percentage (0 at bottom, 100 at top). */
export function yFor(pct: number, box: ChartBox = DEFAULT_BOX): number {
  return box.height - box.pad.bottom - (pct / 100) * (box.height - box.pad.top - box.pad.bottom);
}

/** One x tick per bucket, carrying the bucket's stop, pixel x and n. */
export function xTicks(
  format: CalibrationFormat,
  buckets: BucketStat[],
  box: ChartBox = DEFAULT_BOX,
): { stop: number; x: number; n: number }[] {
  return buckets.map((b) => ({ stop: b.stop, x: xFor(b.stop, format, box), n: b.n }));
}

/** y axis ticks at 0, 25, 50, 75, 100 with pixel positions. */
export function yTicks(box: ChartBox = DEFAULT_BOX): { value: number; y: number }[] {
  return [0, 25, 50, 75, 100].map((value) => ({ value, y: yFor(value, box) }));
}
