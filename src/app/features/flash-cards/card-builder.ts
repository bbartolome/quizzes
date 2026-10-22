import { Concept, KnowledgeBase } from '../../core/models/quiz.models';
import { confusedWith } from '../glossary/glossary-search';
import { shuffle } from '../../core/utils/shuffle';

export type CardDirection = 'definition-to-term' | 'example-to-term' | 'term-to-definition';

export type PromptFormat = 'plain' | 'italic' | 'bold';

export interface FlashCard {
  direction: CardDirection;
  legend: string;
  prompt: string;
  promptFormat: PromptFormat;
  options: string[];
  optionConcepts: Concept[];
  correctIndex: number;
}

interface OptionRecord {
  text: string;
  concept: Concept;
  isTarget: boolean;
}

const LEGENDS: Record<CardDirection, Record<Concept['type'], string>> = {
  'definition-to-term': {
    fallacy: 'Which fallacy is this?',
    bias: 'Which bias is this?',
  },
  'example-to-term': {
    fallacy: 'Which fallacy does this example show?',
    bias: 'Which bias does this example show?',
  },
  'term-to-definition': {
    fallacy: 'What does this fallacy mean?',
    bias: 'What does this bias mean?',
  },
};

function directionFor(r: number): CardDirection {
  if (r < 1 / 3) {
    return 'definition-to-term';
  }
  if (r < 2 / 3) {
    return 'example-to-term';
  }
  return 'term-to-definition';
}

function promptFor(
  target: Concept,
  direction: CardDirection,
): { prompt: string; promptFormat: PromptFormat } {
  switch (direction) {
    case 'definition-to-term':
      return { prompt: target.shortDefinition, promptFormat: 'plain' };
    case 'example-to-term':
      return { prompt: target.example, promptFormat: 'italic' };
    case 'term-to-definition':
      return { prompt: target.name, promptFormat: 'bold' };
  }
}

/** Builds one flash card. Consumes rng in the order documented in the S3 plan. */
export function buildCard(target: Concept, kb: KnowledgeBase, rng: () => number): FlashCard {
  // 1. Direction (one rng call).
  const direction = directionFor(rng());

  // 2. Legend and prompt (no rng).
  const legend = LEGENDS[direction][target.type];
  const { prompt, promptFormat } = promptFor(target, direction);

  // 3. Lures: confused partners first, then fill from both decks.
  const partners = confusedWith(target, kb);
  const shuffledPartners = shuffle(partners, rng);
  let lures = shuffledPartners.slice(0, 3);
  if (lures.length < 3) {
    const pool = kb.concepts.filter((c) => c.id !== target.id && !lures.some((l) => l.id === c.id));
    const shuffledPool = shuffle(pool, rng);
    lures = [...lures, ...shuffledPool.slice(0, 3 - lures.length)];
  }

  // 4. Option records (no rng).
  const isTermToDef = direction === 'term-to-definition';
  const records: OptionRecord[] = [
    { text: isTermToDef ? target.shortDefinition : target.name, concept: target, isTarget: true },
    ...lures.map((lure) => ({
      text: isTermToDef ? lure.shortDefinition : lure.name,
      concept: lure,
      isTarget: false,
    })),
  ];

  // 5. Final option shuffle.
  const shuffledRecords = shuffle(records, rng);
  const correctIndex = shuffledRecords.findIndex((r) => r.isTarget);
  const options = shuffledRecords.map((r) => r.text);
  const optionConcepts = shuffledRecords.map((r) => r.concept);

  return { direction, legend, prompt, promptFormat, options, optionConcepts, correctIndex };
}
