import { describe, expect, it } from 'vitest';
import { CalibrationAnswer, CalibrationFormat } from './calibration.models';
import { scoreSide } from './score-side';
import {
  meanBrier,
  meanConfidence,
  overconfidence,
  overconfidenceLabel,
  percentCorrect,
  skillScore,
} from './scoring';

const twoWay: CalibrationAnswer[] = [
  { itemId: 'a', pick: 0, confidence: 90, correct: true },
  { itemId: 'b', pick: 1, confidence: 100, correct: false },
  { itemId: 'c', pick: 0, confidence: 60, correct: true },
  { itemId: 'd', pick: 1, confidence: 70, correct: true },
];

const fourWay: CalibrationAnswer[] = [
  { itemId: 'a', pick: [true, false], confidence: 75, correct: true },
  { itemId: 'b', pick: [false, false], confidence: 100, correct: false },
  { itemId: 'c', pick: [true, true], confidence: 25, correct: false },
];

describe('scoreSide', () => {
  it('returns null for no answers', () => {
    expect(scoreSide([], 'two-way')).toBeNull();
    expect(scoreSide([], 'four-way')).toBeNull();
  });

  const cases: [CalibrationFormat, CalibrationAnswer[]][] = [
    ['two-way', twoWay],
    ['four-way', fourWay],
  ];

  for (const [format, answers] of cases) {
    describe(format, () => {
      it('derives skill and brier from the mean Brier', () => {
        const side = scoreSide(answers, format)!;
        const brier = meanBrier(answers)!;
        expect(side.brier).toBe(brier);
        expect(side.skill).toBe(skillScore(brier, format));
      });

      it('derives confidence, accuracy and overconfidence from scoring', () => {
        const side = scoreSide(answers, format)!;
        expect(side.meanConfidence).toBe(meanConfidence(answers));
        expect(side.percentCorrect).toBe(percentCorrect(answers));
        expect(side.overconfidence).toBe(overconfidence(answers));
      });

      it('labels the overconfidence', () => {
        const side = scoreSide(answers, format)!;
        expect(side.label).toBe(overconfidenceLabel(overconfidence(answers)!));
      });
    });
  }
});
