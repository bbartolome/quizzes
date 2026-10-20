import { skillScore } from './scoring';
import type { CalibrationFormat } from './calibration.models';

export interface CalibrationSummary {
  roundsPlayed: number;
  brierSum: number;
  answerCount: number;
}

export function calibrationCardStats(
  summary: CalibrationSummary,
  format: CalibrationFormat,
): { roundsPlayed: number; skillScore: number | null } {
  const score =
    summary.answerCount === 0
      ? null
      : skillScore(summary.brierSum / summary.answerCount, format);
  return { roundsPlayed: summary.roundsPlayed, skillScore: score };
}
