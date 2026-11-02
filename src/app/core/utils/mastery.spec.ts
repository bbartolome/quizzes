import { describe, it, expect } from 'vitest';
import { ConceptEvidence } from '../models/practice.models';
import { daysFor, masteryOf } from './mastery';

function evidence(overrides: Partial<ConceptEvidence>): ConceptEvidence {
  return { attempted: 0, correct: 0, days: 0, ...overrides };
}

describe('masteryOf', () => {
  it('is New when nothing has been attempted', () => {
    expect(masteryOf(evidence({ attempted: 0, correct: 0, days: 0 }))).toBe('new');
  });

  it('is Learning with one attempt, even when it was wrong', () => {
    expect(masteryOf(evidence({ attempted: 1, correct: 0, days: 1 }))).toBe('learning');
    expect(masteryOf(evidence({ attempted: 1, correct: 1, days: 1 }))).toBe('learning');
  });

  it('stays Learning below four attempts, however accurate', () => {
    expect(masteryOf(evidence({ attempted: 3, correct: 3, days: 3 }))).toBe('learning');
  });

  it('is Practised at four attempts with p >= 0.60', () => {
    // p = (3 + 0.5) / 5 = 0.70
    expect(masteryOf(evidence({ attempted: 4, correct: 3, days: 1 }))).toBe('practised');
  });

  it('is Learning at four attempts when p < 0.60', () => {
    // p = (2 + 0.5) / 5 = 0.50
    expect(masteryOf(evidence({ attempted: 4, correct: 2, days: 1 }))).toBe('learning');
  });

  it('is Mastered at 7 of 8 correct over two days (p = 0.833)', () => {
    expect(masteryOf(evidence({ attempted: 8, correct: 7, days: 2 }))).toBe('mastered');
  });

  it('is only Practised at 6 of 8 correct (p = 0.722), even over two days', () => {
    expect(masteryOf(evidence({ attempted: 8, correct: 6, days: 2 }))).toBe('practised');
  });

  it('is Practised, not Mastered, with 7 of 8 correct on a single day', () => {
    expect(masteryOf(evidence({ attempted: 8, correct: 7, days: 1 }))).toBe('practised');
  });

  it('is Practised, not Mastered, with fewer than eight attempts', () => {
    expect(masteryOf(evidence({ attempted: 7, correct: 7, days: 2 }))).toBe('practised');
  });

  it('is Learning with eight attempts when p < 0.60', () => {
    // p = (2 + 0.5) / 9 = 0.28
    expect(masteryOf(evidence({ attempted: 8, correct: 2, days: 3 }))).toBe('learning');
  });

  it('demotes from Mastered when accuracy falls', () => {
    const before = evidence({ attempted: 8, correct: 7, days: 2 });
    const after = evidence({ attempted: 10, correct: 7, days: 2 });
    expect(masteryOf(before)).toBe('mastered');
    // p = (7 + 0.5) / 11 = 0.68
    expect(masteryOf(after)).toBe('practised');
  });

  it('requires a challenge attempt count of 3 when requiresChallenge is set', () => {
    const base = { attempted: 8, correct: 8, days: 2, requiresChallenge: true };
    expect(masteryOf(evidence({ ...base, challengeAttempts: 2 }))).toBe('practised');
    expect(masteryOf(evidence({ ...base, challengeAttempts: 3 }))).toBe('mastered');
  });

  it('is not Mastered with requiresChallenge and no challenge attempts recorded', () => {
    expect(
      masteryOf(evidence({ attempted: 8, correct: 8, days: 2, requiresChallenge: true })),
    ).toBe('practised');
  });

  it('ignores challengeAttempts when requiresChallenge is not set', () => {
    expect(
      masteryOf(
        evidence({ attempted: 8, correct: 8, days: 2, requiresChallenge: false, challengeAttempts: 0 }),
      ),
    ).toBe('mastered');
  });
});

describe('daysFor', () => {
  it('is 0 for a concept with no attempts and no conceptDays entry', () => {
    expect(daysFor(undefined, 0)).toBe(0);
  });

  it('counts a legacy concept (attempted > 0, no entry) as one day', () => {
    expect(daysFor(undefined, 5)).toBe(1);
    expect(daysFor(undefined, 1)).toBe(1);
  });

  it('uses the recorded days when a conceptDays entry exists', () => {
    expect(daysFor({ days: 3, lastDay: '2026-11-01' }, 5)).toBe(3);
  });
});
