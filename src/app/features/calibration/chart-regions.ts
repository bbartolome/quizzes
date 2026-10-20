import { ChartBox, DEFAULT_BOX, Line, xFor, yFor } from './chart-scales';
import { ChartPoint } from './chart-series';
import { FORMATS } from './calibration-format';
import type { CalibrationFormat } from './calibration.models';

export function diagonal(format: CalibrationFormat, box: ChartBox = DEFAULT_BOX): Line {
  const [min] = FORMATS[format].axis;
  return {
    x1: xFor(min, format, box),
    y1: yFor(min, box),
    x2: xFor(100, format, box),
    y2: yFor(100, box),
  };
}

export function chanceLine(format: CalibrationFormat, box: ChartBox = DEFAULT_BOX): Line {
  const [min] = FORMATS[format].axis;
  const y = yFor(FORMATS[format].chance, box);
  return {
    x1: xFor(min, format, box),
    y1: y,
    x2: xFor(100, format, box),
    y2: y,
  };
}

function pair(x: number, y: number): string {
  return `${x},${y}`;
}

export function regions(format: CalibrationFormat, box: ChartBox = DEFAULT_BOX): { overRegion: string; underRegion: string } {
  const [min] = FORMATS[format].axis;
  const L = xFor(min, format, box);
  const R = xFor(100, format, box);
  const B = yFor(0, box);
  const T = yFor(100, box);
  const yMin = yFor(min, box);
  const overRegion = [pair(L, yMin), pair(R, T), pair(R, B), pair(L, B)].join(' ');
  const underRegion = [pair(L, yMin), pair(L, T), pair(R, T)].join(' ');
  return { overRegion, underRegion };
}

export function flagRings(format: CalibrationFormat, points: ChartPoint[]): { x: number; y: number }[] {
  const rings: { x: number; y: number }[] = [];
  for (const p of points) {
    const flag = (p.stop === 100 && p.hits < p.n) || (format === 'four-way' && p.stop === 0 && p.n > 0);
    if (flag) rings.push({ x: p.x, y: p.y });
  }
  return rings;
}
