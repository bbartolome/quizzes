import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseRoundFilters,
  weakTraitWeights,
  pickTemplate,
  shuffle,
} from './round-builder';
import { Template, KnowledgeBaseEntry } from '../../core/models/quiz.models';

function makeTemplate(overrides: Partial<Template> & { id: string }): Template {
  return {
    pattern: 'A pattern with no slots.',
    slots: {},
    correctAnswers: ['Correct A'],
    distractors: ['Distractor A'],
    category: 'fallacy',
    explanation: `Explanation for ${overrides.id}`,
    ...overrides,
  };
}

function makeKbEntry(overrides: Partial<KnowledgeBaseEntry> & { id: string }): KnowledgeBaseEntry {
  return {
    name: overrides.id,
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
    ...overrides,
  };
}

describe('parseRoundFilters', () => {
  it('maps a known cat value to a single-element categories array', () => {
    const result = parseRoundFilters({ cat: 'fallacy', traits: null, weakTraits: null });
    expect(result.categories).toEqual(['fallacy']);
  });

  it('leaves categories undefined when cat is not a recognized category', () => {
    const result = parseRoundFilters({ cat: 'nonsense', traits: null, weakTraits: null });
    expect(result.categories).toBeUndefined();
  });

  it('splits traits on commas, trims whitespace, and drops empty entries', () => {
    const result = parseRoundFilters({ cat: null, traits: ' a, b ,,c ', weakTraits: null });
    expect(result.traitIds).toEqual(['a', 'b', 'c']);
  });

  it('leaves traitIds undefined when traits param is null or yields no entries', () => {
    expect(parseRoundFilters({ cat: null, traits: null, weakTraits: null }).traitIds).toBeUndefined();
    expect(parseRoundFilters({ cat: null, traits: ' , , ', weakTraits: null }).traitIds).toBeUndefined();
  });

  it('sets weakTraits true only when the param is the literal string "true"', () => {
    expect(parseRoundFilters({ cat: null, traits: null, weakTraits: 'true' }).weakTraits).toBe(true);
    expect(parseRoundFilters({ cat: null, traits: null, weakTraits: 'false' }).weakTraits).toBe(false);
    expect(parseRoundFilters({ cat: null, traits: null, weakTraits: null }).weakTraits).toBe(false);
  });
});

describe('weakTraitWeights', () => {
  it('assigns weights that decrease by one from first to last, length down to 1', () => {
    const weights = weakTraitWeights(['t1', 't2', 't3']);
    expect(weights).toEqual({ t1: 3, t2: 2, t3: 1 });
  });

  it('returns an empty object for an empty input array', () => {
    expect(weakTraitWeights([])).toEqual({});
  });
});

describe('pickTemplate', () => {
  let rng: () => number;

  beforeEach(() => {
    rng = vi.fn(() => 0);
  });

  it('filters to templates matching the requested categories', () => {
    const templates = [
      makeTemplate({ id: 'fallacy-1', category: 'fallacy' }),
      makeTemplate({ id: 'bias-1', category: 'bias' }),
    ];

    const picked = pickTemplate(templates, [], { weakTraits: false, categories: ['bias'] }, rng);

    expect(picked?.id).toBe('bias-1');
  });

  it('filters to templates whose correctAnswers include a kb name for the given traitIds, case-insensitively', () => {
    const kb = [makeKbEntry({ id: 'kb-1', name: 'Straw Man' })];
    const templates = [
      makeTemplate({ id: 'matches-trait', correctAnswers: ['STRAW MAN'] }),
      makeTemplate({ id: 'no-match', correctAnswers: ['Ad Hominem'] }),
    ];

    const picked = pickTemplate(
      templates,
      kb,
      { weakTraits: false, traitIds: ['kb-1'] },
      rng,
    );

    expect(picked?.id).toBe('matches-trait');
  });

  it('returns undefined when no templates match the filters', () => {
    const templates = [makeTemplate({ id: 'fallacy-1', category: 'fallacy' })];

    const picked = pickTemplate(templates, [], { weakTraits: false, categories: ['bias'] }, rng);

    expect(picked).toBeUndefined();
  });

  it('selects via Math.floor(rng() * n) indexing into the filtered list', () => {
    const templates = [
      makeTemplate({ id: 't0' }),
      makeTemplate({ id: 't1' }),
      makeTemplate({ id: 't2' }),
    ];
    rng = vi.fn(() => 2 / 3);

    const picked = pickTemplate(templates, [], { weakTraits: false }, rng);

    expect(picked?.id).toBe('t2');
  });
});

describe('shuffle', () => {
  it('returns a new array containing exactly the same elements', () => {
    const items = [1, 2, 3, 4, 5];

    const result = shuffle(items, () => 0.5);

    expect(result).not.toBe(items);
    expect([...result].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5] as const;
    const copy = [...items];

    shuffle(items, () => 0.5);

    expect(items).toEqual(copy);
  });

  it('is deterministic for a given rng, matching the Fisher-Yates result', () => {
    const items = ['a', 'b', 'c', 'd'];

    const result = shuffle(items, () => 0);

    // Fisher-Yates from i = n-1 downto 1, j = floor(rng() * (i+1)), swap(i, j):
    // i=3: j=0 -> [d,b,c,a]; i=2: j=0 -> [c,b,d,a]; i=1: j=0 -> [b,c,d,a]
    expect(result).toEqual(['b', 'c', 'd', 'a']);
  });
});
