import { scoreSide, type ScoreSide } from './score-side';
import {
  reviewSections,
  type ReviewSection,
} from './review-sections';
import { bucketStats } from './scoring';
import type {
  BucketStat,
  CalibrationAnswer,
  CalibrationBank,
  CalibrationFormat,
  CalibrationRound,
} from './calibration.models';

export interface ResultsView {
  format: CalibrationFormat;
  firstRound: boolean;
  round: ScoreSide;
  before: ScoreSide | null;
  delta: number | null;
  roundBuckets: BucketStat[];
  beforeBuckets: BucketStat[];
  sections: ReviewSection[];
}

export function buildResultsView(
  format: CalibrationFormat,
  bank: CalibrationBank,
  round: CalibrationRound,
  before: CalibrationAnswer[],
): ResultsView {
  const roundSide = scoreSide(round.answers, format)!;
  const beforeSide = scoreSide(before, format);

  return {
    format,
    firstRound: before.length === 0,
    round: roundSide,
    before: beforeSide,
    delta: beforeSide ? roundSide.skill - beforeSide.skill : null,
    roundBuckets: bucketStats(round.answers, format),
    beforeBuckets: bucketStats(before, format),
    sections: reviewSections(bank, round.answers, format),
  };
}
