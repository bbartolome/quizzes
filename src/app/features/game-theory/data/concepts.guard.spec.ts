import { describe, expect, it } from 'vitest';
import type { GameTheoryConcept, GameTheoryContent } from '../../../core/models/quiz.models';
import type { MisconceptionId } from '../lib/puzzle.types';
import knowledgeBaseJson from '../../../../../public/data/concepts/knowledge-base.json';
import conceptsJson from '../../../../../public/data/quizzes/game-theory/concepts.json';

// Build-time guards over the shipped game-theory concepts (spec §6.5). The pinned tables below
// are the concept set (§6.2), the prerequisite graph (§6.4) and the confused pairs (§6.3).

const content = conceptsJson as unknown as GameTheoryContent;
const concepts: GameTheoryConcept[] = content.concepts;
const pairs = content.pairs;
const byId = new Map(concepts.map((c) => [c.id, c]));
const knowledgeBaseIds = new Set<string>(knowledgeBaseJson.concepts.map((c) => c.id));

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REQUIRED_KEYS = [
  'id',
  'name',
  'shortDefinition',
  'longExplanation',
  'example',
  'type',
  'tier',
  'prerequisites',
  'modes',
] as const;
const TEXT_KEYS = ['name', 'shortDefinition', 'longExplanation', 'example'] as const;
const ALLOWED_KEYS = [...REQUIRED_KEYS, 'spottingTip', 'misconception', 'source'];
const VALID_MODES: readonly GameTheoryConcept['modes'][number][] = [
  'cards',
  'equilibrium',
  'classify',
  'eliminate',
  'bots',
  'beauty',
  'auction',
];
const MISCONCEPTIONS: readonly MisconceptionId[] = [
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  'M7',
  'M8',
  'M10',
  'M11',
  'M12',
  'M13',
  'M14',
];

const TIERS: Record<string, number> = {
  'dominant-strategy': 1,
  'iterated-elimination': 1,
  'best-response': 1,
  'nash-equilibrium': 1,
  'pareto-efficiency': 1,
  'prisoners-dilemma': 1,
  'stag-hunt': 1,
  'chicken-game': 1,
  'coordination-game': 1,
  'battle-of-the-sexes': 1,
  'mixed-strategy': 1,
  'backward-induction': 2,
  'repeated-game': 3,
  'tit-for-tat': 3,
  'first-price-auction': 4,
  'second-price-auction': 4,
  'winners-curse': 4,
  'level-k-reasoning': 5,
};

const PREREQUISITES: Record<string, string[]> = {
  'dominant-strategy': [],
  'iterated-elimination': ['dominant-strategy'],
  'best-response': [],
  'nash-equilibrium': ['best-response'],
  'pareto-efficiency': [],
  'prisoners-dilemma': ['dominant-strategy', 'nash-equilibrium', 'pareto-efficiency'],
  'stag-hunt': ['nash-equilibrium', 'pareto-efficiency'],
  'chicken-game': ['nash-equilibrium'],
  'coordination-game': ['nash-equilibrium'],
  'battle-of-the-sexes': ['coordination-game'],
  'mixed-strategy': ['nash-equilibrium'],
  'backward-induction': ['nash-equilibrium'],
  'repeated-game': ['prisoners-dilemma'],
  'tit-for-tat': ['repeated-game'],
  'second-price-auction': ['dominant-strategy'],
  'first-price-auction': ['best-response', 'second-price-auction'],
  'winners-curse': ['first-price-auction'],
  'level-k-reasoning': ['iterated-elimination', 'best-response'],
};

const EXPECTED_PAIRS: [string, string][] = [
  ['prisoners-dilemma', 'stag-hunt'],
  ['prisoners-dilemma', 'chicken-game'],
  ['nash-equilibrium', 'pareto-efficiency'],
  ['stag-hunt', 'coordination-game'],
  ['coordination-game', 'battle-of-the-sexes'],
  ['dominant-strategy', 'best-response'],
  ['nash-equilibrium', 'backward-induction'],
  ['first-price-auction', 'second-price-auction'],
  ['prisoners-dilemma', 'repeated-game'],
  ['nash-equilibrium', 'level-k-reasoning'],
];

/** Kebab-case of a display name: "Prisoner's dilemma" becomes "prisoners-dilemma". */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pairKey(ids: readonly string[]): string {
  return [...ids].sort().join(' / ');
}

/** Returns an id on a prerequisite cycle, or null when the graph is a DAG. */
function cycleStart(): string | null {
  const done = new Set<string>();
  const onPath = new Set<string>();
  const visit = (id: string): string | null => {
    if (onPath.has(id)) return id;
    if (done.has(id)) return null;
    onPath.add(id);
    for (const prerequisite of byId.get(id)?.prerequisites ?? []) {
      const hit = visit(prerequisite);
      if (hit) return hit;
    }
    onPath.delete(id);
    done.add(id);
    return null;
  };
  for (const c of concepts) {
    const hit = visit(c.id);
    if (hit) return hit;
  }
  return null;
}

describe('game-theory concepts (G8)', () => {
  it('has the 18 concepts of spec §6.2, with their tiers', () => {
    expect(concepts).toHaveLength(18);
    expect(Object.fromEntries(concepts.map((c) => [c.id, c.tier]))).toEqual(TIERS);
  });

  it('has the prerequisite graph of spec §6.4', () => {
    const expected = Object.fromEntries(
      Object.entries(PREREQUISITES).map(([id, pre]) => [id, [...pre].sort()]),
    );
    expect(Object.fromEntries(concepts.map((c) => [c.id, [...c.prerequisites].sort()]))).toEqual(
      expected,
    );
  });

  it('has the 10 confused pairs of spec §6.3', () => {
    expect(pairs.map((p) => pairKey(p.concepts)).sort()).toEqual(
      EXPECTED_PAIRS.map(pairKey).sort(),
    );
  });

  it('guard: ids are unique', () => {
    const ids = concepts.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('guard: ids are kebab-case and equal the kebab-case name', () => {
    for (const c of concepts) {
      expect(c.id, `kebab-case id ${c.id}`).toMatch(KEBAB);
      expect(c.id, `id of "${c.name}"`).toBe(slug(c.name));
    }
  });

  it('guard: ids are disjoint from knowledge-base ids', () => {
    for (const c of concepts) {
      expect(knowledgeBaseIds.has(c.id), `${c.id} is a knowledge-base id`).toBe(false);
    }
  });

  it('guard: required fields are present and non-empty', () => {
    for (const c of concepts) {
      for (const key of REQUIRED_KEYS) expect(c, `${c.id} is missing ${key}`).toHaveProperty(key);
      for (const key of TEXT_KEYS) {
        expect(c[key].trim(), `${c.id}.${key}`).not.toBe('');
      }
      expect(c.type).toBe('game-theory');
    }
  });

  it('guard: concepts carry only the allowed keys', () => {
    for (const c of concepts) {
      for (const key of Object.keys(c)) expect(ALLOWED_KEYS, `${c.id}.${key}`).toContain(key);
    }
  });

  it('guard: tier is an integer from 1 to 5', () => {
    for (const c of concepts) {
      expect(Number.isInteger(c.tier), `${c.id} tier`).toBe(true);
      expect(c.tier >= 1 && c.tier <= 5, `${c.id} tier ${c.tier}`).toBe(true);
    }
  });

  it('guard: every prerequisite exists', () => {
    for (const c of concepts) {
      for (const prerequisite of c.prerequisites) {
        expect(byId.has(prerequisite), `${c.id} needs unknown ${prerequisite}`).toBe(true);
      }
    }
  });

  it('guard: the prerequisite graph has no cycle', () => {
    expect(cycleStart(), 'cycle through this concept').toBeNull();
  });

  it("guard: a concept's tier is at least each prerequisite's tier", () => {
    for (const c of concepts) {
      for (const prerequisite of c.prerequisites) {
        const pre = byId.get(prerequisite);
        if (!pre) continue;
        expect(
          c.tier,
          `${c.id} (tier ${c.tier}) needs ${pre.id} (tier ${pre.tier})`,
        ).toBeGreaterThanOrEqual(pre.tier);
      }
    }
  });

  it('guard: modes are non-empty, unique and valid', () => {
    for (const c of concepts) {
      expect(c.modes.length, `${c.id} has modes`).toBeGreaterThan(0);
      expect(new Set(c.modes).size, `${c.id} modes are unique`).toBe(c.modes.length);
      for (const mode of c.modes) expect(VALID_MODES, `${c.id} mode ${mode}`).toContain(mode);
    }
  });

  it('guard: misconception, when present, is a known id', () => {
    for (const c of concepts) {
      if (c.misconception === undefined) continue;
      expect(MISCONCEPTIONS, `${c.id} misconception`).toContain(c.misconception);
    }
  });

  it('guard: source, when present, has a label and an https url', () => {
    for (const c of concepts) {
      if (c.source === undefined) continue;
      expect(c.source.label.trim(), `${c.id} source label`).not.toBe('');
      expect(c.source.url, `${c.id} source url`).toMatch(/^https:\/\//);
    }
  });

  it('guard: pairs have the shape { concepts: [a, b], tip }', () => {
    for (const p of pairs) {
      expect(p.concepts).toHaveLength(2);
      for (const key of Object.keys(p)) expect(['concepts', 'tip']).toContain(key);
      expect(p.tip?.trim(), `tip for ${pairKey(p.concepts)}`).not.toBe('');
    }
  });

  it('guard: pairs reference known concept ids', () => {
    for (const p of pairs) {
      for (const id of p.concepts) expect(byId.has(id), `unknown id ${id}`).toBe(true);
    }
  });

  it('guard: no self-pairs', () => {
    for (const p of pairs) expect(p.concepts[0], pairKey(p.concepts)).not.toBe(p.concepts[1]);
  });

  it('guard: no duplicate pairs in either order', () => {
    const seen = new Set<string>();
    for (const p of pairs) {
      const key = pairKey(p.concepts);
      expect(seen.has(key), `duplicate pair ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('guard: every pair tip names both of its concepts', () => {
    for (const p of pairs) {
      const tip = (p.tip ?? '').toLowerCase();
      for (const id of p.concepts) {
        const name = byId.get(id)?.name ?? id;
        expect(tip, `tip for ${pairKey(p.concepts)} names ${name}`).toContain(name.toLowerCase());
      }
    }
  });
});
