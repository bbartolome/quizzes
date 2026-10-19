import type {
  AnswerFlag,
  BucketStat,
  CalibrationAnswer,
  CalibrationFormat,
  CalibrationItem,
  CalibrationPick,
  ReviewGroup,
} from './calibration.models';
import { isFourWayItem } from './calibration.models';
import { FORMATS } from './calibration-format';

/** A pick is correct when it matches the item's truth exactly. */
export function isCorrect(item: CalibrationItem, pick: CalibrationPick): boolean {
  if (isFourWayItem(item)) {
    const p = pick as [boolean, boolean];
    return p[0] === item.truth[0] && p[1] === item.truth[1];
  }
  return pick === item.correct;
}

/** Brier score of a single answer, with c = confidence / 100. */
export function answerBrier(confidence: number, correct: boolean): number {
  const c = confidence / 100;
  return correct ? (1 - c) * (1 - c) : c * c;
}

/** Mean Brier of a set of answers; null when the set is empty. */
export function meanBrier(answers: CalibrationAnswer[]): number | null {
  if (answers.length === 0) return null;
  const total = answers.reduce((sum, a) => sum + answerBrier(a.confidence, a.correct), 0);
  return total / answers.length;
}

/**
 * Skill score on a 0–100 scale anchored to the format's chance rate.
 * Not clamped: it can go below 0.
 */
export function skillScore(brier: number, format: CalibrationFormat): number {
  const { chance, guessingBrier } = FORMATS[format];
  return Math.round(chance + (100 - chance) * (1 - brier / guessingBrier));
}

/** Mean confidence (0–100); null when the set is empty. */
export function meanConfidence(answers: CalibrationAnswer[]): number | null {
  if (answers.length === 0) return null;
  return answers.reduce((sum, a) => sum + a.confidence, 0) / answers.length;
}

/** Share correct, on a 0–100 scale; null when the set is empty. */
export function percentCorrect(answers: CalibrationAnswer[]): number | null {
  if (answers.length === 0) return null;
  const hits = answers.filter((a) => a.correct).length;
  return (hits / answers.length) * 100;
}

/** Mean confidence minus percent correct, in points; null when the set is empty. */
export function overconfidence(answers: CalibrationAnswer[]): number | null {
  const conf = meanConfidence(answers);
  const pct = percentCorrect(answers);
  if (conf === null || pct === null) return null;
  return conf - pct;
}

/** Human label for an overconfidence value in points. */
export function overconfidenceLabel(points: number): string {
  if (Math.abs(points) <= 2) return 'well calibrated';
  const n = Math.round(Math.abs(points));
  return points > 0 ? `${n} points overconfident` : `${n} points underconfident`;
}

export interface WilsonInterval {
  lo: number;
  hi: number;
}

/**
 * Wilson 95% score interval for `hits` successes out of `n` trials, on a
 * 0–100 scale; null when n is 0. Clamped to 0–100.
 */
export function wilson(hits: number, n: number): WilsonInterval | null {
  if (n === 0) return null;
  const z = 1.96;
  const z2 = z * z;
  const p = hits / n;
  const denominator = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const clamp = (x: number) => Math.min(100, Math.max(0, x * 100));
  return {
    lo: clamp((center - margin) / denominator),
    hi: clamp((center + margin) / denominator),
  };
}

/** One bucket per confidence stop of the format, in stop order. */
export function bucketStats(answers: CalibrationAnswer[], format: CalibrationFormat): BucketStat[] {
  return FORMATS[format].stops.map((stop) => {
    const inBucket = answers.filter((a) => a.confidence === stop);
    const n = inBucket.length;
    const hits = inBucket.filter((a) => a.correct).length;
    if (n === 0) return { stop, n: 0, hits: 0, pct: null, lo: null, hi: null };
    const interval = wilson(hits, n)!;
    return { stop, n, hits, pct: (hits / n) * 100, lo: interval.lo, hi: interval.hi };
  });
}

/** Whether an answer sits on one of the format's "confident" stops. */
export function isConfident(answer: CalibrationAnswer, format: CalibrationFormat): boolean {
  return FORMATS[format].confidentStops.includes(answer.confidence);
}

/** Which review bucket an answer falls into. */
export function reviewGroup(answer: CalibrationAnswer, format: CalibrationFormat): ReviewGroup {
  if (!answer.correct) {
    return isConfident(answer, format) ? 'confident-miss' : 'hedged-miss';
  }
  return isConfident(answer, format) ? 'confident-hit' : 'underplayed-hit';
}

/** Notable flags for a single answer. */
export function flags(answer: CalibrationAnswer, format: CalibrationFormat): AnswerFlag[] {
  const result: AnswerFlag[] = [];
  if (!answer.correct && answer.confidence === 100) result.push('miss-at-100');
  if (format === 'four-way' && answer.confidence === 0) result.push('below-chance');
  return result;
}
