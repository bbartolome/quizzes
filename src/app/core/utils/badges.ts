import type { BadgeContext, BadgeDef, MasteryState } from '../models/practice.models';
import type { ConfusedPair } from '../models/quiz.models';

/** Ids of the defs that are earned in `ctx`, in definition order. */
export function earnedBadges(defs: readonly BadgeDef[], ctx: BadgeContext): string[] {
  return defs.filter((def) => def.earned(ctx)).map((def) => def.id);
}

type Calibration = BadgeContext['calibration'][number];

function isPractised(state: MasteryState | undefined): boolean {
  return state === 'practised' || state === 'mastered';
}

/** Which knows-what-it-knows group an answer falls in, or null for the middle band. */
function confidenceGroup(entry: Calibration): 'high' | 'low' | null {
  const { confidence, format } = entry;
  if (format === 'four-way') {
    if (confidence >= 75) return 'high';
    if (confidence <= 25) return 'low';
    return null;
  }
  if (confidence >= 80) return 'high';
  if (confidence <= 60) return 'low';
  return null;
}

const KNOWS_MIN_ANSWERS = 30;
const KNOWS_MIN_PER_GROUP = 8;

const SURE_CONFIDENCE = 90;
const SURE_MIN_ANSWERS = 20;

export const NOTICES_LOOKALIKES: BadgeDef = {
  id: 'notices-lookalikes',
  title: 'Notices lookalikes',
  insight: 'You tell confusable concepts apart.',
  criterion: 'Both concepts of any confused pair are Practised',
  earned: ({ mastery, pairs }: BadgeContext) =>
    pairs.some((pair: ConfusedPair) =>
      pair.concepts.every((id) => isPractised(mastery.get(id))),
    ),
};

export const NAMES_THE_TRAP: BadgeDef = {
  id: 'names-the-trap',
  title: 'Names the trap',
  insight: 'You can name what you spot.',
  criterion: 'At least 8 of the 16 knowledge-base concepts are Practised',
  earned: ({ mastery }: BadgeContext) => {
    let practised = 0;
    for (const state of mastery.values()) {
      if (isPractised(state)) practised++;
    }
    return practised >= 8;
  },
};

export const KNOWS_WHAT_IT_KNOWS: BadgeDef = {
  id: 'knows-what-it-knows',
  title: 'Knows what it knows',
  insight: 'Your confident answers are right more often than your guesses.',
  criterion:
    'Over at least 30 lifetime Confidence answers, with at least 8 in each group, the hit rate at confidence ≥ 80% beats the hit rate at ≤ 60% by ≥ 20 points',
  earned: ({ calibration }: BadgeContext) => {
    if (calibration.length < KNOWS_MIN_ANSWERS) return false;
    let nHigh = 0;
    let hitsHigh = 0;
    let nLow = 0;
    let hitsLow = 0;
    for (const entry of calibration) {
      const group = confidenceGroup(entry);
      if (group === 'high') {
        nHigh++;
        if (entry.correct) hitsHigh++;
      } else if (group === 'low') {
        nLow++;
        if (entry.correct) hitsLow++;
      }
    }
    if (nHigh < KNOWS_MIN_PER_GROUP || nLow < KNOWS_MIN_PER_GROUP) return false;
    // hitsHigh/nHigh - hitsLow/nLow >= 0.20, multiplied out to avoid float drift at the boundary.
    return 5 * (hitsHigh * nLow - hitsLow * nHigh) >= nHigh * nLow;
  },
};

export const SURE_MEANS_SURE: BadgeDef = {
  id: 'sure-means-sure',
  title: 'Sure means sure',
  insight: 'Your high-confidence answers hold up.',
  criterion: 'At least 20 answers at confidence ≥ 90%, with a hit rate ≥ 85%',
  earned: ({ calibration }: BadgeContext) => {
    let n = 0;
    let hits = 0;
    for (const entry of calibration) {
      if (entry.confidence < SURE_CONFIDENCE) continue;
      n++;
      if (entry.correct) hits++;
    }
    // hits/n >= 0.85, kept in integers.
    return n >= SURE_MIN_ANSWERS && hits * 100 >= 85 * n;
  },
};

export const CROSS_QUIZ_BADGES: readonly BadgeDef[] = [
  NOTICES_LOOKALIKES,
  NAMES_THE_TRAP,
  KNOWS_WHAT_IT_KNOWS,
  SURE_MEANS_SURE,
];
