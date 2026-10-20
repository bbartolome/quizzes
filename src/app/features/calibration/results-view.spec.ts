import { describe, expect, it } from 'vitest';
import { bucketStats } from './scoring';
import {
  CalibrationAnswer,
  CalibrationBank,
  CalibrationRound,
  TwoWayItem,
} from './calibration.models';
import { buildResultsView } from './results-view';
import { reviewSections } from './review-sections';
import { scoreSide } from './score-side';

const source = { label: 'Wikipedia', url: 'https://en.wikipedia.org/' };

const item = (id: string): TwoWayItem => ({
  id,
  prompt: `Prompt ${id}`,
  options: ['Whale', 'Shark'],
  correct: 1,
  topic: 'nature',
  fact: `Fact ${id}.`,
  source,
});

const bank: CalibrationBank = {
  version: 1,
  items: [item('s1'), item('s2'), item('s3'), item('s4')],
};

const answer = (itemId: string, confidence: number, correct: boolean): CalibrationAnswer => ({
  itemId,
  pick: correct ? 1 : 0,
  confidence,
  correct,
});

const roundAnswers = [
  answer('s1', 100, false),
  answer('s2', 60, false),
  answer('s3', 60, true),
  answer('s4', 90, true),
];

const round: CalibrationRound = {
  submittedAt: '2026-01-01T00:00:00.000Z',
  bankVersion: 1,
  answers: roundAnswers,
};

const earlier = [answer('x1', 80, true), answer('x2', 70, false)];

describe('buildResultsView', () => {
  it('marks the first round when there are no earlier answers', () => {
    const view = buildResultsView('two-way', bank, round, []);
    expect(view.format).toBe('two-way');
    expect(view.firstRound).toBe(true);
    expect(view.before).toBeNull();
    expect(view.delta).toBeNull();
    expect(view.beforeBuckets).toEqual(bucketStats([], 'two-way'));
  });

  it('scores the round from its own answers', () => {
    const view = buildResultsView('two-way', bank, round, earlier);
    expect(view.round).toEqual(scoreSide(roundAnswers, 'two-way'));
    expect(view.roundBuckets).toEqual(bucketStats(roundAnswers, 'two-way'));
  });

  it('scores the lifetime before the round and the delta against it', () => {
    const view = buildResultsView('two-way', bank, round, earlier);
    const before = scoreSide(earlier, 'two-way')!;
    expect(view.firstRound).toBe(false);
    expect(view.before).toEqual(before);
    expect(view.delta).toBe(view.round.skill - before.skill);
    expect(view.beforeBuckets).toEqual(bucketStats(earlier, 'two-way'));
  });

  it('builds review sections from the round answers in fixed order', () => {
    const view = buildResultsView('two-way', bank, round, earlier);
    expect(view.sections).toEqual(reviewSections(bank, roundAnswers, 'two-way'));
    expect(view.sections.map((s) => s.group)).toEqual([
      'confident-miss',
      'hedged-miss',
      'underplayed-hit',
      'confident-hit',
    ]);
  });

  it('uses the four-way format for buckets', () => {
    const view = buildResultsView('four-way', bank, round, []);
    expect(view.format).toBe('four-way');
    expect(view.roundBuckets).toEqual(bucketStats(roundAnswers, 'four-way'));
    expect(view.roundBuckets).toHaveLength(5);
  });
});
