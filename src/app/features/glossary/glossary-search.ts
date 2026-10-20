import { KnowledgeBaseEntry } from '../../core/models/quiz.models';

export function filterEntries(kb: KnowledgeBaseEntry[], query: string): KnowledgeBaseEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return kb;
  }
  return kb.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) || entry.shortDefinition.toLowerCase().includes(q),
  );
}

export function confusedWith(
  entry: KnowledgeBaseEntry,
  kb: KnowledgeBaseEntry[],
): KnowledgeBaseEntry[] {
  return entry.commonlyConfusedWith
    .map((id) => kb.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is KnowledgeBaseEntry => candidate !== undefined);
}
