import { Concept, ConfusedPair, KnowledgeBase } from '../../core/models/quiz.models';

export type Contrast =
  | { kind: 'pair-tip'; target: string; lure: string; tip: string }
  | { kind: 'side-by-side'; lure: Concept; lureSpottingTip?: string }
  | { kind: 'correct-tip'; tip: string }
  | { kind: 'none' };

export interface Feedback {
  verdict: 'Correct' | 'Incorrect';
  answer: string;
  explanation: string;
  spottingTip?: string;
  contrast: Contrast;
}

/** The first pair in kb.pairs that holds both concepts, regardless of stored order. */
function pairBetween(a: Concept, b: Concept, kb: KnowledgeBase): ConfusedPair | undefined {
  return kb.pairs.find((pair) => pair.concepts.includes(a.id) && pair.concepts.includes(b.id));
}

function correctContrast(
  target: Concept,
  options: readonly Concept[],
  kb: KnowledgeBase,
): Contrast {
  // First partner in option order whose pair with the target has a tip.
  for (const option of options) {
    if (option.id === target.id) {
      continue;
    }
    const tip = pairBetween(target, option, kb)?.tip;
    if (tip) {
      return { kind: 'correct-tip', tip };
    }
  }

  // No usable partner among the options: the first tipped pair of the target.
  const fallback = kb.pairs.find((pair) => pair.concepts.includes(target.id) && pair.tip);
  if (fallback?.tip) {
    return { kind: 'correct-tip', tip: fallback.tip };
  }

  return { kind: 'none' };
}

function wrongContrast(target: Concept, lure: Concept, kb: KnowledgeBase): Contrast {
  const tip = pairBetween(target, lure, kb)?.tip;
  if (tip) {
    return { kind: 'pair-tip', target: target.name, lure: lure.name, tip };
  }
  if (lure.spottingTip !== undefined) {
    return { kind: 'side-by-side', lure, lureSpottingTip: lure.spottingTip };
  }
  return { kind: 'side-by-side', lure };
}

/**
 * Feedback for one answered flash card. `picked` is null when the target was picked.
 * `options` are the option concepts in the order shown (card.optionConcepts). Does not mutate inputs.
 */
export function buildFeedback(
  target: Concept,
  picked: Concept | null,
  options: readonly Concept[],
  kb: KnowledgeBase,
): Feedback {
  const feedback: Feedback = {
    verdict: picked === null ? 'Correct' : 'Incorrect',
    answer: target.name,
    explanation: target.longExplanation,
    contrast:
      picked === null ? correctContrast(target, options, kb) : wrongContrast(target, picked, kb),
  };
  if (target.spottingTip !== undefined) {
    feedback.spottingTip = target.spottingTip;
  }
  return feedback;
}
