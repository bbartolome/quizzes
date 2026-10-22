import { Concept, KnowledgeBase } from '../../core/models/quiz.models';

export function filterEntries(kb: Concept[], query: string): Concept[] {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return kb;
  }
  return kb.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) || entry.shortDefinition.toLowerCase().includes(q),
  );
}

export function confusedWith(entry: Concept, kb: KnowledgeBase): Concept[] {
  const partners: Concept[] = [];
  for (const [a, b] of kb.pairs.map((pair) => pair.concepts)) {
    const partnerId = a === entry.id ? b : b === entry.id ? a : undefined;
    const partner = kb.concepts.find((candidate) => candidate.id === partnerId);
    if (partner) {
      partners.push(partner);
    }
  }
  return partners;
}

export function pairTip(a: string, b: string, kb: KnowledgeBase): string | undefined {
  return kb.pairs.find((pair) => pair.concepts.includes(a) && pair.concepts.includes(b))?.tip;
}
