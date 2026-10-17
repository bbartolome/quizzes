import { Template, KnowledgeBaseEntry } from '../../core/models/quiz.models';

export interface RoundFilters {
  categories?: ('fallacy' | 'bias')[];
  traitIds?: string[];
  weakTraits: boolean;
}

export function parseRoundFilters(q: {
  cat: string | null;
  traits: string | null;
  weakTraits: string | null;
}): RoundFilters {
  let categories: ('fallacy' | 'bias')[] | undefined;
  if (q.cat === 'fallacy' || q.cat === 'bias') {
    categories = [q.cat];
  }

  let traitIds: string[] | undefined;
  if (q.traits) {
    const parsed = q.traits
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    traitIds = parsed.length > 0 ? parsed : undefined;
  }

  return {
    categories,
    traitIds,
    weakTraits: q.weakTraits === 'true',
  };
}

export function weakTraitWeights(weakIds: string[]): Record<string, number> {
  const weights: Record<string, number> = {};
  const len = weakIds.length;
  for (let i = 0; i < len; i++) {
    weights[weakIds[i]] = len - i;
  }
  return weights;
}

export function pickTemplate(
  templates: Template[],
  kb: KnowledgeBaseEntry[],
  f: RoundFilters,
  rng: () => number = Math.random,
): Template | undefined {
  let matched = templates;

  if (f.categories) {
    const cats = new Set(f.categories);
    matched = matched.filter((t) => cats.has(t.category));
  }

  if (f.traitIds && f.traitIds.length > 0) {
    const wanted = new Set(f.traitIds);
    const names = new Set(
      kb
        .filter((entry) => wanted.has(entry.id))
        .map((entry) => entry.name.toLowerCase()),
    );
    matched = matched.filter((t) =>
      t.correctAnswers.some((a) => names.has(a.toLowerCase())),
    );
  }

  if (matched.length === 0) {
    return undefined;
  }

  return matched[Math.floor(rng() * matched.length)];
}

export function shuffle<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function traitIdsForAnswers(
  correctAnswers: string[],
  kb: KnowledgeBaseEntry[],
): string[] {
  const nameToId = new Map<string, string>();
  for (const entry of kb) {
    nameToId.set(entry.name.toLowerCase(), entry.id);
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const answer of correctAnswers) {
    const id = nameToId.get(answer.toLowerCase());
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}
