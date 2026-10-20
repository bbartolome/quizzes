import {
  meanBrier,
  meanConfidence,
  overconfidence,
  overconfidenceLabel,
  percentCorrect,
  skillScore,
} from './scoring';
import {
  type CalibrationAnswer,
  type CalibrationFormat,
} from './calibration.models';

export interface ScoreSide {
  skill: number;
  brier: number;
  meanConfidence: number;
  percentCorrect: number;
  overconfidence: number;
  label: string;
}

export function scoreSide(
  answers: CalibrationAnswer[],
  format: CalibrationFormat,
): ScoreSide | null {
  const brier = meanBrier(answers);
  const confidence = meanConfidence(answers);
  const correct = percentCorrect(answers);
  const over = overconfidence(answers);
  if (brier === null || confidence === null || correct === null || over === null) {
    return null;
  }
  return {
    skill: skillScore(brier, format),
    brier,
    meanConfidence: confidence,
    percentCorrect: correct,
    overconfidence: over,
    label: overconfidenceLabel(over),
  };
}
