import {
  Concept,
  ConfusedPair,
  KnowledgeBase,
  ScoredQuestionResult,
} from '../../core/models/quiz.models';

export type OptionStatus = 'correct' | 'wrong' | 'missed' | 'neutral';

export interface ConfusionTip {
  a: string;
  b: string;
  tip: string;
}

export function optionStatus(r: ScoredQuestionResult, option: string): OptionStatus {
  if (r.extra.includes(option)) {
    return 'wrong';
  }
  if (r.missed.includes(option)) {
    return 'missed';
  }
  if (r.selected.includes(option) && r.question.correctAnswers.includes(option)) {
    return 'correct';
  }
  return 'neutral';
}

export function findConfusionTips(options: string[], kb: KnowledgeBase): ConfusionTip[] {
  // Map lowercased concept name -> concept (first wins on duplicate names).
  const byName = new Map<string, Concept>();
  for (const concept of kb.concepts) {
    const key = concept.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, concept);
    }
  }

  // Concepts matched by the options, keyed by id, in option order.
  const matched = new Map<string, Concept>();
  for (const option of options) {
    const concept = byName.get(option.toLowerCase());
    if (concept && !matched.has(concept.id)) {
      matched.set(concept.id, concept);
    }
  }

  // For each matched X (in option order), emit each pair containing X whose partner Y is also
  // matched and which has a tip. a is the concept met first in option order; pairs are not repeated.
  const tips: ConfusionTip[] = [];
  const emitted = new Set<ConfusedPair>();
  for (const x of matched.values()) {
    for (const pair of kb.pairs) {
      if (emitted.has(pair) || pair.tip === undefined || !pair.concepts.includes(x.id)) {
        continue;
      }
      const partnerId = pair.concepts[0] === x.id ? pair.concepts[1] : pair.concepts[0];
      const y = matched.get(partnerId);
      if (!y) {
        continue;
      }
      emitted.add(pair);
      tips.push({ a: x.name, b: y.name, tip: pair.tip });
    }
  }

  return tips;
}

export function summaryLine(results: ScoredQuestionResult[]): string {
  const correct = results.filter((r) => r.correct === true).length;
  const total = results.length;
  return `${correct} of ${total} correct`;
}

export const STATUS_LABELS: Record<OptionStatus, string> = {
  correct: 'Correct',
  wrong: 'Wrong pick',
  missed: 'Missed',
  neutral: 'Not picked',
};
