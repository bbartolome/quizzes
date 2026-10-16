import { KnowledgeBaseEntry, ScoredQuestionResult } from "../../core/models/quiz.models";

export type OptionStatus = "correct" | "wrong" | "missed" | "neutral";

export interface ConfusionTip {
  a: string;
  b: string;
  tip: string;
}

export function optionStatus(r: ScoredQuestionResult, option: string): OptionStatus {
  if (r.extra.includes(option)) {
    return "wrong";
  }
  if (r.missed.includes(option)) {
    return "missed";
  }
  if (r.selected.includes(option) && r.question.correctAnswers.includes(option)) {
    return "correct";
  }
  return "neutral";
}

export function findConfusionTips(
  options: string[],
  kb: KnowledgeBaseEntry[]
): ConfusionTip[] {
  // Map lowercased entry name -> entry (first wins on duplicate names).
  const byName = new Map<string, KnowledgeBaseEntry>();
  for (const entry of kb) {
    const key = entry.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, entry);
    }
  }

  // Map entry id -> entry.
  const byId = new Map<string, KnowledgeBaseEntry>();
  for (const entry of kb) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }

  // Determine which KB entries are matched by the options, preserving option order.
  const matchedSet = new Set<KnowledgeBaseEntry>();
  const matched: KnowledgeBaseEntry[] = [];
  for (const option of options) {
    const entry = byName.get(option.toLowerCase());
    if (entry && !matchedSet.has(entry)) {
      matchedSet.add(entry);
      matched.push(entry);
    }
  }

  // For each matched X (in options order) and each id in X.commonlyConfusedWith
  // whose entry Y is also matched, emit { a: X.name, b: Y.name, tip: X.distinguishingTip }.
  // One tip per unordered pair (first wins); order follows options.
  const seenPairs = new Set<string>();
  const tips: ConfusionTip[] = [];
  for (const x of matched) {
    for (const confusedId of x.commonlyConfusedWith) {
      const y = byId.get(confusedId);
      if (!y || !matchedSet.has(y)) {
        continue;
      }
      const pairKey = [x.name.toLowerCase(), y.name.toLowerCase()]
        .sort()
        .join("\u0000");
      if (seenPairs.has(pairKey)) {
        continue;
      }
      seenPairs.add(pairKey);
      tips.push({ a: x.name, b: y.name, tip: x.distinguishingTip });
    }
  }

  return tips;
}

export function summaryLine(results: ScoredQuestionResult[]): string {
  const correct = results.filter((r) => r.correct === true).length;
  const total = results.length;
  return `${correct} of ${total} correct`;
}
