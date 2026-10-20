import {
  BucketStat,
  CalibrationBank,
  CalibrationFormat,
  CalibrationHistory,
} from './calibration.models';
import { bucketStats, skillScore } from './scoring';
import { ROUND_SIZE, unseenCount } from './draw';

export interface HomeStats {
  hasPending: boolean;
  roundsPlayed: number;
  lifetimeSkill: number | null;
  lifetimeBuckets: BucketStat[];
  showRepeats: boolean;
}

export function homeStats(
  history: CalibrationHistory,
  bank: CalibrationBank,
  format: CalibrationFormat,
): HomeStats {
  const log = history.log;
  const { brierSum, answerCount, roundsPlayed } = history.summary;

  return {
    hasPending: history.pending !== null,
    roundsPlayed,
    lifetimeSkill: answerCount > 0 ? skillScore(brierSum / answerCount, format) : null,
    lifetimeBuckets: bucketStats(
      log.flatMap((r) => r.answers),
      format,
    ),
    showRepeats: log.length > 0 && unseenCount(bank, log) < Math.min(ROUND_SIZE, bank.items.length),
  };
}
