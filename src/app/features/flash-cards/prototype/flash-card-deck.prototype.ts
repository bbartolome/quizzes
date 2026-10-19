// PROTOTYPE — throwaway. Answers "What does answering a flash card feel like?" (issue #17).
// Card building for the flash card prototype. No tests, no persistence.
import { KnowledgeBaseEntry } from '../../../core/models/quiz.models';

export type Direction = 'definition→term' | 'example→term' | 'term→definition';
export type DistractorMode = 'confused' | 'random';
export type Pool = 'type' | 'all';

export interface DeckSettings {
  options: number;
  distractors: DistractorMode;
  pool: Pool;
}

export interface CardOption {
  entry: KnowledgeBaseEntry;
  label: string;
  source: 'answer' | 'commonlyConfusedWith' | 'random';
}

export interface Card {
  serial: number;
  direction: Direction;
  target: KnowledgeBaseEntry;
  prompt: string;
  options: CardOption[];
  chosen?: string;
}

export interface Tip {
  kind: 'pair' | 'confused' | 'fallback' | 'none';
  lure?: KnowledgeBaseEntry;
  text?: string;
}

const shuffle = <T>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Weighted 2:1 toward → term, per the drilling research (recognising a bias in the wild).
const pickDirection = (): Direction => {
  const r = Math.random();
  return r < 1 / 3 ? 'definition→term' : r < 2 / 3 ? 'example→term' : 'term→definition';
};

export function buildCard(
  kb: KnowledgeBaseEntry[],
  conceptType: 'bias' | 'fallacy',
  settings: DeckSettings,
  serial: number,
  previousTargetId?: string,
): Card {
  const ofType = kb.filter((e) => e.type === conceptType);
  const target = shuffle(ofType.filter((e) => e.id !== previousTargetId))[0];
  const pool = (settings.pool === 'type' ? ofType : kb).filter((e) => e.id !== target.id);
  const byId = new Map(kb.map((e) => [e.id, e]));

  const picked: CardOption[] = [];
  if (settings.distractors === 'confused') {
    const confused = [
      ...target.commonlyConfusedWith,
      ...kb.filter((e) => e.commonlyConfusedWith.includes(target.id)).map((e) => e.id),
    ];
    for (const id of new Set(confused)) {
      const e = byId.get(id);
      if (e && pool.includes(e) && picked.length < settings.options - 1) {
        picked.push({ entry: e, label: '', source: 'commonlyConfusedWith' });
      }
    }
  }
  for (const e of shuffle(pool)) {
    if (picked.length >= settings.options - 1) break;
    if (!picked.some((p) => p.entry.id === e.id)) picked.push({ entry: e, label: '', source: 'random' });
  }

  const direction = pickDirection();
  const labelFor = (e: KnowledgeBaseEntry) => (direction === 'term→definition' ? e.shortDefinition : e.name);
  const prompt =
    direction === 'definition→term'
      ? target.shortDefinition
      : direction === 'example→term'
        ? target.example
        : target.name;

  const options = shuffle([{ entry: target, label: '', source: 'answer' as const }, ...picked]).map((o) => ({
    ...o,
    label: labelFor(o.entry),
  }));
  return { serial, direction, target, prompt, options };
}

export function directionLabel(card: Card, conceptType: 'bias' | 'fallacy'): string {
  const noun = conceptType === 'bias' ? 'bias' : 'fallacy';
  switch (card.direction) {
    case 'definition→term':
      return `Which ${noun} is this?`;
    case 'example→term':
      return `Which ${noun} does this example show?`;
    case 'term→definition':
      return `What does this ${noun} mean?`;
  }
}

export const isCorrect = (card: Card) => card.chosen === card.target.id;

// The "how to tell it apart" tip. Only 6 of 16 entries have an authored pair tip,
// so most wrong answers fall back to a side-by-side of the two definitions.
export function tipFor(card: Card, kb: KnowledgeBaseEntry[]): Tip {
  const t = card.target;
  if (!card.chosen) return { kind: 'none' };
  if (card.chosen !== t.id) {
    const lure = kb.find((e) => e.id === card.chosen)!;
    if (t.commonlyConfusedWith.includes(lure.id)) return { kind: 'pair', lure, text: t.distinguishingTip };
    if (lure.commonlyConfusedWith.includes(t.id)) return { kind: 'pair', lure, text: lure.distinguishingTip };
    return { kind: 'fallback', lure };
  }
  if (t.commonlyConfusedWith.length) {
    const lure = kb.find((e) => e.id === t.commonlyConfusedWith[0]);
    return { kind: 'confused', lure, text: t.distinguishingTip };
  }
  return { kind: 'none' };
}
