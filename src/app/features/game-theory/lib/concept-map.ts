import type { GameTheoryConcept } from '../../../core/models/quiz.models';
import type { MasteryState } from '../../../core/models/practice.models';

// The hub's concept map (spec §7.3, §3.1). Pure: it takes the content, the mastery state of each
// concept and the introduced set, and returns what the page draws. Glyphs and words always come
// together, so colour is never the only signal (spec §7.3, §12).

export const NODE_GLYPH: Readonly<Record<MasteryState, string>> = {
  new: '○',
  learning: '◔',
  practised: '◑',
  mastered: '●',
};

export const NODE_WORD: Readonly<Record<MasteryState, string>> = {
  new: 'New',
  learning: 'Learning',
  practised: 'Practised',
  mastered: 'Mastered',
};

export interface ConceptMapNode {
  id: string;
  name: string;
  state: MasteryState;
  glyph: string;
  word: string;
  /** The name of the first prerequisite not yet introduced, or null when none is missing. */
  recommendedFirst: string | null;
}

export interface ConceptMapTier {
  tier: GameTheoryConcept['tier'];
  nodes: ConceptMapNode[];
}

/**
 * Groups the concepts by tier, lowest tier first, keeping content order inside each tier. A node
 * whose prerequisites are unmet still appears, and still opens (§7.2): it only names what to do first.
 */
export function buildConceptMap(
  concepts: readonly GameTheoryConcept[],
  states: Readonly<Record<string, MasteryState>>,
  introduced: ReadonlySet<string>,
): ConceptMapTier[] {
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const tiers = [...new Set(concepts.map((concept) => concept.tier))].sort((a, b) => a - b);

  return tiers.map((tier) => ({
    tier,
    nodes: concepts
      .filter((concept) => concept.tier === tier)
      .map((concept) => {
        const evidence: MasteryState = states[concept.id] ?? 'new';
        // An introduced concept (§7.2) has started its tutorial, so with no evidence yet it reads
        // Learning, not New. Evidence that already says more is kept.
        const state: MasteryState =
          evidence === 'new' && introduced.has(concept.id) ? 'learning' : evidence;
        const missing = concept.prerequisites.find((id) => !introduced.has(id));
        return {
          id: concept.id,
          name: concept.name,
          state,
          glyph: NODE_GLYPH[state],
          word: NODE_WORD[state],
          recommendedFirst: missing === undefined ? null : (byId.get(missing)?.name ?? missing),
        };
      }),
  }));
}
