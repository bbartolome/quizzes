import { describe, expect, it } from 'vitest';
import {
  CalibrationAnswer,
  CalibrationBank,
  FourWayItem,
  TwoWayItem,
} from './calibration.models';
import { reviewRow, reviewSections } from './review-sections';

const source = { label: 'Wikipedia', url: 'https://en.wikipedia.org/' };

const twoWay = (id: string, correct: 0 | 1 = 1): TwoWayItem => ({
  id,
  prompt: `Prompt ${id}`,
  options: ['Whale', 'Shark'],
  correct,
  topic: 'nature',
  fact: `Fact ${id}.`,
  source,
});

const fourWay: FourWayItem = {
  id: 'a001',
  prompt: 'Which of these is a mammal?',
  options: ['Platypus', 'Penguin'],
  truth: [true, false],
  topic: 'nature',
  facts: ['Platypus fact.', 'Penguin fact.'],
  source,
};

const answer = (
  itemId: string,
  pick: CalibrationAnswer['pick'],
  confidence: number,
  correct: boolean,
): CalibrationAnswer => ({ itemId, pick, confidence, correct });

describe('reviewRow', () => {
  it('fills a two-way miss with the correct label and a single fact', () => {
    const row = reviewRow(twoWay('s1'), answer('s1', 0, 80, false), 'two-way');
    expect(row).toEqual({
      itemId: 's1',
      prompt: 'Prompt s1',
      confidence: 80,
      pickLabel: 'Whale',
      correctLabel: 'Shark',
      facts: ['Fact s1.'],
      source,
      flags: [],
    });
  });

  it('leaves correctLabel null on a hit', () => {
    const row = reviewRow(twoWay('s1'), answer('s1', 1, 90, true), 'two-way');
    expect(row.pickLabel).toBe('Shark');
    expect(row.correctLabel).toBeNull();
  });

  it('flags a miss at 100', () => {
    const row = reviewRow(twoWay('s1'), answer('s1', 0, 100, false), 'two-way');
    expect(row.flags).toEqual(['miss-at-100']);
  });

  it('uses both facts and labels for a four-way item', () => {
    const row = reviewRow(fourWay, answer('a001', [false, false], 50, false), 'four-way');
    expect(row.facts).toEqual(['Platypus fact.', 'Penguin fact.']);
    expect(row.pickLabel).toBe('Neither');
    expect(row.correctLabel).toBe('Platypus');
  });

  it('flags four-way 0% as below-chance', () => {
    const row = reviewRow(fourWay, answer('a001', [true, false], 0, true), 'four-way');
    expect(row.flags).toEqual(['below-chance']);
  });
});

describe('reviewSections', () => {
  const bank: CalibrationBank = {
    version: 1,
    items: ['s1', 's2', 's3', 's4'].map((id) => twoWay(id)),
  };
  const confidentHit = answer('s1', 1, 100, true);
  const underplayedHit = answer('s2', 1, 60, true);
  const hedgedMiss = answer('s3', 0, 60, false);
  const confidentMiss = answer('s4', 0, 90, false);

  it('orders groups and sets open only for the miss groups', () => {
    const sections = reviewSections(
      bank,
      [confidentHit, underplayedHit, hedgedMiss, confidentMiss],
      'two-way',
    );
    expect(sections.map((s) => [s.group, s.title, s.open])).toEqual([
      ['confident-miss', 'Confident misses', true],
      ['hedged-miss', 'Hedged misses', true],
      ['underplayed-hit', 'Underplayed hits', false],
      ['confident-hit', 'Confident hits', false],
    ]);
    expect(sections[0].rows.map((r) => r.itemId)).toEqual(['s4']);
  });

  it('drops empty groups', () => {
    const sections = reviewSections(bank, [confidentHit, hedgedMiss], 'two-way');
    expect(sections.map((s) => s.group)).toEqual(['hedged-miss', 'confident-hit']);
  });

  it('skips answers whose item is not in the bank', () => {
    const sections = reviewSections(
      bank,
      [answer('gone', 0, 100, false), confidentHit],
      'two-way',
    );
    expect(sections.map((s) => s.group)).toEqual(['confident-hit']);
    expect(sections[0].rows).toHaveLength(1);
  });

  it('returns no sections for no answers', () => {
    expect(reviewSections(bank, [], 'two-way')).toEqual([]);
  });
});
