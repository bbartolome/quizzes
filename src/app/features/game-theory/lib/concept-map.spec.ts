import { describe, expect, it } from 'vitest';
import type { GameTheoryConcept } from '../../../core/models/quiz.models';
import { NODE_GLYPH, NODE_WORD, buildConceptMap } from './concept-map';

function concept(
  id: string,
  tier: GameTheoryConcept['tier'],
  prerequisites: string[] = [],
): GameTheoryConcept {
  return {
    id,
    name: id.replace(/(^|-)(\w)/g, (_, dash: string, letter: string) => `${dash ? ' ' : ''}${letter.toUpperCase()}`),
    shortDefinition: '',
    longExplanation: '',
    example: '',
    type: 'game-theory',
    tier,
    prerequisites,
    modes: ['cards'],
  };
}

const CONCEPTS: GameTheoryConcept[] = [
  concept('best-response', 1),
  concept('nash-equilibrium', 1, ['best-response']),
  concept('backward-induction', 2, ['nash-equilibrium']),
  concept('dominant-strategy', 1),
];

describe('buildConceptMap (spec §7.3, §3.1 hub map)', () => {
  it('groups concepts by tier in ascending order, keeping the content order inside a tier', () => {
    const map = buildConceptMap(CONCEPTS, {}, new Set());

    expect(map.map((tier) => tier.tier)).toEqual([1, 2]);
    expect(map[0].nodes.map((node) => node.id)).toEqual([
      'best-response',
      'nash-equilibrium',
      'dominant-strategy',
    ]);
    expect(map[1].nodes.map((node) => node.id)).toEqual(['backward-induction']);
  });

  it('gives each node its state, glyph and word, and New for a concept with no state', () => {
    const map = buildConceptMap(
      CONCEPTS,
      { 'best-response': 'mastered', 'nash-equilibrium': 'practised' },
      new Set(),
    );
    const nodes = map.flatMap((tier) => tier.nodes);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));

    expect(byId['best-response']).toMatchObject({
      state: 'mastered',
      glyph: NODE_GLYPH.mastered,
      word: NODE_WORD.mastered,
    });
    expect(byId['nash-equilibrium']).toMatchObject({ state: 'practised', glyph: '◑' });
    expect(byId['dominant-strategy']).toMatchObject({ state: 'new', glyph: '○', word: 'New' });
  });

  it('uses the words Learning and Practised beside their glyphs, so colour is never the only signal', () => {
    expect(NODE_GLYPH).toEqual({ new: '○', learning: '◔', practised: '◑', mastered: '●' });
    expect(NODE_WORD).toEqual({
      new: 'New',
      learning: 'Learning',
      practised: 'Practised',
      mastered: 'Mastered',
    });
  });

  it('names the first unmet prerequisite as the recommendation, and nothing once they are introduced', () => {
    const unmet = buildConceptMap(CONCEPTS, {}, new Set());
    const nash = unmet.flatMap((tier) => tier.nodes).find((node) => node.id === 'nash-equilibrium');
    expect(nash?.recommendedFirst).toBe('Best Response');

    const met = buildConceptMap(CONCEPTS, {}, new Set(['best-response']));
    const nashMet = met.flatMap((tier) => tier.nodes).find((node) => node.id === 'nash-equilibrium');
    expect(nashMet?.recommendedFirst).toBeNull();
  });

  it('keeps a node with unmet prerequisites open: it still has its state and is never removed', () => {
    const map = buildConceptMap(CONCEPTS, {}, new Set());

    expect(map.flatMap((tier) => tier.nodes).map((node) => node.id)).toContain('backward-induction');
  });

  it('returns no tiers for an empty concept list', () => {
    expect(buildConceptMap([], {}, new Set())).toEqual([]);
  });
});
