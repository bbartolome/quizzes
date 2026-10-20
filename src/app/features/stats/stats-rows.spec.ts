import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traitRows, overallAccuracy } from './stats-rows';
import { QuizStats, KnowledgeBaseEntry, PerTraitStats } from '../../core/models/quiz.models';

function makeStats(perTrait: Record<string, PerTraitStats>): QuizStats {
  return {
    quizId: 'quiz-1',
    version: 1,
    perTrait,
    streak: 0,
    roundsPlayed: 0,
  };
}

function makeKbEntry(
  overrides: Partial<KnowledgeBaseEntry> & { id: string; name: string },
): KnowledgeBaseEntry {
  return {
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
    ...overrides,
  };
}

describe('traitRows', () => {
  it('builds one row per perTrait entry with attempted > 0', () => {
    const stats = makeStats({
      strawman: { traitId: 'strawman', correct: 3, attempted: 4 },
    });
    const kb = [makeKbEntry({ id: 'strawman', name: 'Strawman' })];
    expect(traitRows(stats, kb)).toEqual([
      { id: 'strawman', name: 'Strawman', correct: 3, attempted: 4, accuracy: 75 },
    ]);
  });

  it('omits entries with attempted === 0', () => {
    const stats = makeStats({
      strawman: { traitId: 'strawman', correct: 0, attempted: 0 },
      'ad-hominem': { traitId: 'ad-hominem', correct: 1, attempted: 2 },
    });
    const kb = [
      makeKbEntry({ id: 'strawman', name: 'Strawman' }),
      makeKbEntry({ id: 'ad-hominem', name: 'Ad Hominem' }),
    ];
    const rows = traitRows(stats, kb);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('ad-hominem');
  });

  it('falls back to the trait id as name when no kb entry matches', () => {
    const stats = makeStats({
      unknown: { traitId: 'unknown', correct: 1, attempted: 1 },
    });
    expect(traitRows(stats, [])).toEqual([
      { id: 'unknown', name: 'unknown', correct: 1, attempted: 1, accuracy: 100 },
    ]);
  });

  it('rounds accuracy with Math.round', () => {
    const stats = makeStats({
      a: { traitId: 'a', correct: 1, attempted: 3 },
    });
    const kb = [makeKbEntry({ id: 'a', name: 'A' })];
    expect(traitRows(stats, kb)[0].accuracy).toBe(33);
  });

  it('sorts by accuracy ascending', () => {
    const stats = makeStats({
      high: { traitId: 'high', correct: 9, attempted: 10 },
      low: { traitId: 'low', correct: 1, attempted: 10 },
    });
    const kb = [makeKbEntry({ id: 'high', name: 'High' }), makeKbEntry({ id: 'low', name: 'Low' })];
    const rows = traitRows(stats, kb);
    expect(rows.map((r) => r.id)).toEqual(['low', 'high']);
  });

  it('sorts by name ascending when accuracy ties', () => {
    const stats = makeStats({
      b: { traitId: 'b', correct: 1, attempted: 2 },
      a: { traitId: 'a', correct: 1, attempted: 2 },
    });
    const kb = [makeKbEntry({ id: 'b', name: 'Bravo' }), makeKbEntry({ id: 'a', name: 'Alpha' })];
    const rows = traitRows(stats, kb);
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('returns an empty array when perTrait is empty', () => {
    expect(traitRows(makeStats({}), [])).toEqual([]);
  });
});

describe('overallAccuracy', () => {
  let beforeEachRan = false;
  beforeEach(() => {
    beforeEachRan = true;
  });

  it('sums correct and attempted across all traits and rounds the percentage', () => {
    const stats = makeStats({
      a: { traitId: 'a', correct: 3, attempted: 4 },
      b: { traitId: 'b', correct: 1, attempted: 4 },
    });
    expect(overallAccuracy(stats)).toBe(50);
    expect(beforeEachRan).toBe(true);
  });

  it('returns 0 when nothing has been attempted', () => {
    expect(overallAccuracy(makeStats({}))).toBe(0);
  });

  it('returns 0 when all attempted counts are 0', () => {
    const stats = makeStats({
      a: { traitId: 'a', correct: 0, attempted: 0 },
    });
    expect(overallAccuracy(stats)).toBe(0);
  });
});
