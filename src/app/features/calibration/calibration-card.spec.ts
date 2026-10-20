import { describe, expect, it } from 'vitest';
import { calibrationCardStats } from './calibration-card';
import { skillScore } from './scoring';

describe('calibrationCardStats', () => {
  it('returns no Skill score for a zeroed summary', () => {
    const summary = { roundsPlayed: 0, brierSum: 0, answerCount: 0 };
    expect(calibrationCardStats(summary, 'two-way')).toEqual({ roundsPlayed: 0, skillScore: null });
    expect(calibrationCardStats(summary, 'four-way')).toEqual({
      roundsPlayed: 0,
      skillScore: null,
    });
  });

  it('reports rounds played from the summary', () => {
    const summary = { roundsPlayed: 3, brierSum: 6, answerCount: 60 };
    expect(calibrationCardStats(summary, 'two-way').roundsPlayed).toBe(3);
  });

  it('computes the two-way Skill score from the mean Brier', () => {
    const summary = { roundsPlayed: 2, brierSum: 8, answerCount: 40 };
    expect(calibrationCardStats(summary, 'two-way').skillScore).toBe(skillScore(8 / 40, 'two-way'));
  });

  it('computes the four-way Skill score from the mean Brier', () => {
    const summary = { roundsPlayed: 1, brierSum: 3, answerCount: 20 };
    expect(calibrationCardStats(summary, 'four-way').skillScore).toBe(
      skillScore(3 / 20, 'four-way'),
    );
  });

  it('scores pure guessing at the format chance level', () => {
    expect(
      calibrationCardStats({ roundsPlayed: 1, brierSum: 5, answerCount: 20 }, 'two-way').skillScore,
    ).toBe(50);
    expect(
      calibrationCardStats({ roundsPlayed: 1, brierSum: 3.75, answerCount: 20 }, 'four-way')
        .skillScore,
    ).toBe(25);
  });
});
