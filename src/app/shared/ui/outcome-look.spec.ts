import { describe, expect, it } from 'vitest';
import { OUTCOME_LOOK } from './outcome-look';

describe('OUTCOME_LOOK (S3, §7.3)', () => {
  it('maps a picked correct option to the correct state and success tone', () => {
    expect(OUTCOME_LOOK.correct).toEqual({ state: 'correct', tone: 'success' });
  });

  it('maps a picked wrong option to the wrong state and danger tone', () => {
    expect(OUTCOME_LOOK.wrong).toEqual({ state: 'wrong', tone: 'danger' });
  });

  it('maps an unpicked correct option to the missed state and warning tone', () => {
    expect(OUTCOME_LOOK.missed).toEqual({ state: 'missed', tone: 'warning' });
  });

  it('maps an unpicked wrong option to the neutral state and neutral tone', () => {
    expect(OUTCOME_LOOK.neutral).toEqual({ state: 'neutral', tone: 'neutral' });
  });

  it('has exactly the four outcomes', () => {
    expect(Object.keys(OUTCOME_LOOK).sort()).toEqual(['correct', 'missed', 'neutral', 'wrong']);
  });
});
