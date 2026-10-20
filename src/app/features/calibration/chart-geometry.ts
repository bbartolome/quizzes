import type { BucketStat, CalibrationFormat } from './calibration.models';
import { DEFAULT_BOX, type ChartBox, type Line, xTicks, yTicks } from './chart-scales';
import { type ChartPoint, seriesBars, seriesPoints, seriesSegments } from './chart-series';
import { chanceLine, diagonal, flagRings, regions } from './chart-regions';

export { DEFAULT_BOX } from './chart-scales';
export type { ChartBox, Line } from './chart-scales';
export type { ChartPoint } from './chart-series';

export interface ChartGeometry {
  xTicks: { stop: number; x: number; n: number }[];
  yTicks: { value: number; y: number }[];
  points: ChartPoint[];
  bars: Line[];
  segments: Line[];
  overlayPoints: ChartPoint[];
  overlaySegments: Line[];
  diagonal: Line;
  chanceLine: Line;
  overRegion: string;
  underRegion: string;
  flagRings: { x: number; y: number }[];
}

export function chartGeometry(
  format: CalibrationFormat,
  buckets: BucketStat[],
  overlay: BucketStat[] | null = null,
  box: ChartBox = DEFAULT_BOX,
): ChartGeometry {
  const points = seriesPoints(format, buckets, box);
  const region = regions(format, box);
  return {
    xTicks: xTicks(format, buckets, box),
    yTicks: yTicks(box),
    points,
    bars: seriesBars(format, buckets, box),
    segments: seriesSegments(format, buckets, box),
    overlayPoints: overlay ? seriesPoints(format, overlay, box, 4) : [],
    overlaySegments: overlay ? seriesSegments(format, overlay, box, 4) : [],
    diagonal: diagonal(format, box),
    chanceLine: chanceLine(format, box),
    overRegion: region.overRegion,
    underRegion: region.underRegion,
    flagRings: flagRings(format, points),
  };
}
