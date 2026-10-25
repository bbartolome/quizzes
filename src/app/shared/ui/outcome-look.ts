import type { BadgeTone } from './status-badge';
import type { OptionRowState } from './option-row';

export type Outcome = 'correct' | 'wrong' | 'missed' | 'neutral';

export const OUTCOME_LOOK: Record<Outcome, { state: OptionRowState; tone: BadgeTone }> = {
  correct: { state: 'correct', tone: 'success' },
  wrong: { state: 'wrong', tone: 'danger' },
  missed: { state: 'missed', tone: 'warning' },
  neutral: { state: 'neutral', tone: 'neutral' },
};
