import { describe, it, expect, vi } from 'vitest';
import { buildCard, CardDirection, FlashCard } from './card-builder';
import { Concept, KnowledgeBase } from '../../core/models/quiz.models';

const kb: KnowledgeBase = {
  concepts: [
    {
      id: 'straw-man',
      name: 'Straw Man',
      type: 'fallacy',
      shortDefinition: 'Misrepresents the argument.',
      longExplanation: 'l',
      example: 'Claims the opponent said something weaker.',
    },
    {
      id: 'false-dilemma',
      name: 'False Dilemma',
      type: 'fallacy',
      shortDefinition: 'Limits the options to two.',
      longExplanation: 'l',
      example: 'You are either with us or against us.',
    },
    {
      id: 'hasty-generalization',
      name: 'Hasty Generalization',
      type: 'fallacy',
      shortDefinition: 'Generalizes from a small sample.',
      longExplanation: 'l',
      example: 'I met two rude people from X, so all X are rude.',
    },
    {
      id: 'anchoring',
      name: 'Anchoring',
      type: 'bias',
      shortDefinition: 'Sticks to the first number.',
      longExplanation: 'l',
      example: 'The first price you see anchors your judgment.',
    },
    {
      id: 'availability-heuristic',
      name: 'Availability Heuristic',
      type: 'bias',
      shortDefinition: 'Judges by ease of recall.',
      longExplanation: 'l',
      example: 'Plane crashes feel more common because they are memorable.',
    },
    {
      id: 'base-rate-neglect',
      name: 'Base Rate Neglect',
      type: 'bias',
      shortDefinition: 'Ignores the background frequency.',
      longExplanation: 'l',
      example: 'Ignores that most people do not have the condition.',
    },
  ],
  pairs: [
    { concepts: ['straw-man', 'false-dilemma'], tip: 't' },
    { concepts: ['hasty-generalization', 'anchoring'], tip: 't' },
    { concepts: ['availability-heuristic', 'base-rate-neglect'], tip: 't' },
  ],
};
const target = kb.concepts[0]; // straw-man; confusedWith = [false-dilemma] (1 partner)

// Returns the values in order and throws if the builder asks for more than were given.
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    if (index >= values.length) {
      throw new Error(`rng exhausted after ${values.length} calls`);
    }
    return values[index++];
  };
}

// Park-Miller minimal standard generator, deterministic for a given seed.
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function textOf(concept: Concept, direction: CardDirection): string {
  return direction === 'term-to-definition' ? concept.shortDefinition : concept.name;
}

describe('buildCard', () => {
  describe('deterministic cases from the plan fixture', () => {
    it('Case 1: definition-to-term', () => {
      const rng = sequenceRng([0.1, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4]);

      const card = buildCard(target, kb, rng);

      const expected: FlashCard = {
        direction: 'definition-to-term',
        legend: 'Which fallacy is this?',
        prompt: 'Misrepresents the argument.',
        promptFormat: 'plain',
        options: ['Anchoring', 'Straw Man', 'Base Rate Neglect', 'False Dilemma'],
        optionConcepts: [kb.concepts[3], kb.concepts[0], kb.concepts[5], kb.concepts[1]],
        correctIndex: 1,
      };
      expect(card).toEqual(expected);
    });

    it('Case 2: example-to-term', () => {
      const rng = sequenceRng([0.5, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4]);

      const card = buildCard(target, kb, rng);

      const expected: FlashCard = {
        direction: 'example-to-term',
        legend: 'Which fallacy does this example show?',
        prompt: 'Claims the opponent said something weaker.',
        promptFormat: 'italic',
        options: ['Anchoring', 'Straw Man', 'Base Rate Neglect', 'False Dilemma'],
        optionConcepts: [kb.concepts[3], kb.concepts[0], kb.concepts[5], kb.concepts[1]],
        correctIndex: 1,
      };
      expect(card).toEqual(expected);
    });

    it('Case 3: term-to-definition', () => {
      const rng = sequenceRng([0.9, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4]);

      const card = buildCard(target, kb, rng);

      const expected: FlashCard = {
        direction: 'term-to-definition',
        legend: 'What does this fallacy mean?',
        prompt: 'Straw Man',
        promptFormat: 'bold',
        options: [
          'Sticks to the first number.',
          'Misrepresents the argument.',
          'Ignores the background frequency.',
          'Limits the options to two.',
        ],
        optionConcepts: [kb.concepts[3], kb.concepts[0], kb.concepts[5], kb.concepts[1]],
        correctIndex: 1,
      };
      expect(card).toEqual(expected);
    });
  });

  describe('additional behaviours', () => {
    const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

    it('always has 4 options with no duplicates', () => {
      for (const seed of seeds) {
        const card = buildCard(target, kb, seededRng(seed));
        expect(card.options).toHaveLength(4);
        expect(new Set(card.options).size).toBe(4);
      }
    });

    it('places the correct text at correctIndex for each direction', () => {
      for (const seed of seeds) {
        const card = buildCard(target, kb, seededRng(seed));
        expect(card.options[card.correctIndex]).toBe(textOf(target, card.direction));
      }
    });

    it('always includes the confused partner among the options', () => {
      const partner = kb.concepts[1]; // false-dilemma
      for (const seed of seeds) {
        const card = buildCard(target, kb, seededRng(seed));
        expect(card.options).toContain(textOf(partner, card.direction));
      }
    });

    it('uses the legend, prompt and promptFormat for each direction and type', () => {
      const legends: Record<CardDirection, Record<Concept['type'], string>> = {
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
      const prompts: Record<
        CardDirection,
        { field: 'shortDefinition' | 'example' | 'name'; format: string }
      > = {
        'definition-to-term': { field: 'shortDefinition', format: 'plain' },
        'example-to-term': { field: 'example', format: 'italic' },
        'term-to-definition': { field: 'name', format: 'bold' },
      };

      for (const concept of [kb.concepts[0], kb.concepts[3]]) {
        for (const seed of seeds) {
          const card = buildCard(concept, kb, seededRng(seed));
          expect(card.legend).toBe(legends[card.direction][concept.type]);
          expect(card.prompt).toBe(concept[prompts[card.direction].field]);
          expect(card.promptFormat).toBe(prompts[card.direction].format);
        }
      }
    });

    it('fills lures from both decks when the partners do not cover them', () => {
      // anchoring has one partner (hasty-generalization); the fill pool holds fallacies too.
      const anchoring = kb.concepts[3];
      const fallacyNames = kb.concepts.filter((c) => c.type === 'fallacy').map((c) => c.name);
      const someCardHasFallacy = seeds.some((seed) => {
        const card = buildCard(anchoring, kb, seededRng(seed));
        return (
          card.direction !== 'term-to-definition' &&
          card.options.some((o) => fallacyNames.includes(o))
        );
      });
      expect(someCardHasFallacy).toBe(true);
    });

    it('with 0 partners makes 8 rng calls in total', () => {
      const isolated: KnowledgeBase = { concepts: kb.concepts, pairs: [] };
      const rng = vi.fn(seededRng(7));

      buildCard(target, isolated, rng);

      expect(rng).toHaveBeenCalledTimes(8);
    });

    it('with 3 partners makes 6 rng calls and uses only partners as lures', () => {
      const crowded: KnowledgeBase = {
        concepts: kb.concepts,
        pairs: [
          { concepts: ['straw-man', 'false-dilemma'] },
          { concepts: ['straw-man', 'hasty-generalization'] },
          { concepts: ['straw-man', 'anchoring'] },
        ],
      };
      const rng = vi.fn(seededRng(7));

      const card = buildCard(target, crowded, rng);

      expect(rng).toHaveBeenCalledTimes(6);
      for (const partner of [kb.concepts[1], kb.concepts[2], kb.concepts[3]]) {
        expect(card.options).toContain(textOf(partner, card.direction));
      }
    });
  });
});
