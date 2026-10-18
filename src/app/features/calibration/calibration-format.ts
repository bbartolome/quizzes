import type { CalibrationFormat } from './calibration.models';

export interface FormatConfig {
  stops: readonly number[];
  chance: number;
  guessingBrier: number;
  axis: readonly [number, number];
  confidentStops: readonly number[];
}

export const FORMATS: Record<CalibrationFormat, FormatConfig> = {
  'two-way': {
    stops: [50, 60, 70, 80, 90, 100],
    chance: 50,
    guessingBrier: 0.25,
    axis: [50, 100],
    confidentStops: [90, 100],
  },
  'four-way': {
    stops: [0, 25, 50, 75, 100],
    chance: 25,
    guessingBrier: 0.1875,
    axis: [0, 100],
    confidentStops: [75, 100],
  },
};

export function formatOf(entry: { format?: CalibrationFormat }): CalibrationFormat {
  return entry.format ?? 'two-way';
}
