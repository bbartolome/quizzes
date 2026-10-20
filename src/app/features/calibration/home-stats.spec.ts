import { describe, expect, it } from 'vitest';
import {
  CalibrationAnswer,
  CalibrationBank,
  CalibrationHistory,
  CalibrationItem,
  CalibrationRound,
} from './calibration.models';
import { FORMATS } from './calibration-format';
import { homeStats } from './home-stats';
import { skillScore } from './scoring';

function item(i: number): CalibrationItem {
  return {
    id: `i${i}`,
    prompt: `Prompt ${i}`,
    options: ['A', 'B'],
    correct: 0,
    topic: 'history',
    fact: 'Fact',
    source: { label: 'Src', url: 'https://example.com' },
  };
}

function bankOf(size: number): CalibrationBank {
  return { version: 1, items: Array.from({ length: size }, (_, i) => item(i)) };
}

function roundOf(ids: string[]): CalibrationRound {
  const answers: CalibrationAnswer[] = ids.map((itemId) => ({
    itemId,
    pick: 0,
    confidence: 80,
    correct: true,
  }));
  return { submittedAt: '2026-01-01T00:00:00.000Z', bankVersion: 1, answers };
}

function emptyHistory(): CalibrationHistory {
  return {
    quizId: 'q',
    bankVersion: 1,
    log: [],
    summary: { roundsPlayed: 0, brierSum: 0, answerCount: 0 },
    pending: null,
  };
}

function historyWith(ids: string[]): CalibrationHistory {
  return {
    ...emptyHistory(),
    log: [roundOf(ids)],
    summary: { roundsPlayed: 1, brierSum: 0.04 * ids.length, answerCount: ids.length },
  };
}

describe('homeStats', () => {
  it('reports a zeroed state for an empty history', () => {
    const stats = homeStats(emptyHistory(), bankOf(12), 'two-way');
    expect(stats.hasPending).toBe(false);
    expect(stats.roundsPlayed).toBe(0);
    expect(stats.lifetimeSkill).toBeNull();
    expect(stats.showRepeats).toBe(false);
  });

  it('returns one empty lifetime bucket per stop for an empty history', () => {
    const stats = homeStats(emptyHistory(), bankOf(12), 'two-way');
    expect(stats.lifetimeBuckets.map((b) => b.stop)).toEqual([...FORMATS['two-way'].stops]);
    expect(stats.lifetimeBuckets.every((b) => b.n === 0)).toBe(true);
  });

  it('uses four-way stops for four-way buckets', () => {
    const stats = homeStats(emptyHistory(), bankOf(12), 'four-way');
    expect(stats.lifetimeBuckets.map((b) => b.stop)).toEqual([...FORMATS['four-way'].stops]);
  });

  it('flags a pending round', () => {
    const history: CalibrationHistory = {
      ...emptyHistory(),
      pending: { bankVersion: 1, items: [{ itemId: 'i0', swapped: false }], picks: {} },
    };
    expect(homeStats(history, bankOf(12), 'two-way').hasPending).toBe(true);
  });

  it('computes lifetime skill from the summary', () => {
    const history = historyWith(['i0', 'i1', 'i2', 'i3']);
    const stats = homeStats(history, bankOf(12), 'two-way');
    expect(stats.roundsPlayed).toBe(1);
    expect(stats.lifetimeSkill).toBe(skillScore(0.04, 'two-way'));
  });

  it('uses the format when scoring lifetime skill', () => {
    const history = historyWith(['i0', 'i1']);
    expect(homeStats(history, bankOf(12), 'four-way').lifetimeSkill).toBe(
      skillScore(0.04, 'four-way'),
    );
  });

  it('shows the repeats note when every item of a small bank has been seen', () => {
    const bank = bankOf(12);
    const history = historyWith(bank.items.map((i) => i.id));
    expect(homeStats(history, bank, 'two-way').showRepeats).toBe(true);
  });

  it('hides the repeats note while enough unseen items remain for a round', () => {
    // 30 items, 4 seen: 26 unseen >= min(20, 30)
    const history = historyWith(['i0', 'i1', 'i2', 'i3']);
    expect(homeStats(history, bankOf(30), 'two-way').showRepeats).toBe(false);
  });

  it('shows the repeats note once unseen items drop below a full round', () => {
    // 30 items, 15 seen: 15 unseen < 20
    const ids = Array.from({ length: 15 }, (_, i) => `i${i}`);
    expect(homeStats(historyWith(ids), bankOf(30), 'two-way').showRepeats).toBe(true);
  });
});
