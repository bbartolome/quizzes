import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseRoundFilters,
  weakTraitWeights,
  pickTemplate,
  shuffle,
  traitIdsForAnswers,
  kbByName,
  nextQuestion,
  TEMPLATE_PROBABILITY,
  NextQuestionDeps,
} from './round-builder';
import {
  Template,
  KnowledgeBaseEntry,
  RoundQuestion,
  Question,
} from '../../core/models/quiz.models';
import type { QuestionBank, SelectRoundOptions } from '../../core/services/quiz-engine.service';

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
    expect(
      parseRoundFilters({ cat: null, traits: null, weakTraits: null }).traitIds,
    ).toBeUndefined();
    expect(
      parseRoundFilters({ cat: null, traits: ' , , ', weakTraits: null }).traitIds,
    ).toBeUndefined();
  });

  it('sets weakTraits true only when the param is the literal string "true"', () => {
    expect(parseRoundFilters({ cat: null, traits: null, weakTraits: 'true' }).weakTraits).toBe(
      true,
    );
    expect(parseRoundFilters({ cat: null, traits: null, weakTraits: 'false' }).weakTraits).toBe(
      false,
    );
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

    const picked = pickTemplate(templates, kb, { weakTraits: false, traitIds: ['kb-1'] }, rng);

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

describe('traitIdsForAnswers', () => {
  it('matches answer text to kb names case-insensitively', () => {
    const kb = [makeKbEntry({ id: 'kb-1', name: 'Straw Man' })];

    const result = traitIdsForAnswers(['STRAW MAN'], kb);

    expect(result).toEqual(['kb-1']);
  });

  it('returns ids in the order the answers appear', () => {
    const kb = [
      makeKbEntry({ id: 'kb-1', name: 'Straw Man' }),
      makeKbEntry({ id: 'kb-2', name: 'Ad Hominem' }),
    ];

    const result = traitIdsForAnswers(['Ad Hominem', 'Straw Man'], kb);

    expect(result).toEqual(['kb-2', 'kb-1']);
  });

  it('de-duplicates repeated matches', () => {
    const kb = [makeKbEntry({ id: 'kb-1', name: 'Straw Man' })];

    const result = traitIdsForAnswers(['Straw Man', 'STRAW MAN', 'straw man'], kb);

    expect(result).toEqual(['kb-1']);
  });

  it('skips answers with no matching kb entry', () => {
    const kb = [makeKbEntry({ id: 'kb-1', name: 'Straw Man' })];

    const result = traitIdsForAnswers(['Straw Man', 'No trap — sound reasoning'], kb);

    expect(result).toEqual(['kb-1']);
  });

  it('returns an empty array for empty input', () => {
    const kb = [makeKbEntry({ id: 'kb-1', name: 'Straw Man' })];

    expect(traitIdsForAnswers([], kb)).toEqual([]);
  });
});

describe('nextQuestion', () => {
  function makeRoundQuestion(overrides: Partial<RoundQuestion> & { id: string }): RoundQuestion {
    return {
      prompt: 'Prompt',
      options: ['A', 'B'],
      correctAnswers: ['A'],
      traitIds: [],
      explanation: 'Explanation',
      ...overrides,
    };
  }

  function makeDeps(overrides: Partial<NextQuestionDeps> = {}): NextQuestionDeps {
    return {
      questions: [] as Question[],
      templates: [],
      kb: [],
      filters: { weakTraits: false },
      usedIds: new Set<string>(),
      selectRound: vi.fn((_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [
        makeRoundQuestion({ id: 'fixed-1' }),
      ]),
      renderTemplate: vi.fn((tpl: Template, traitIds: string[]) => ({
        id: 'rendered',
        prompt: tpl.pattern,
        options: [...tpl.correctAnswers, ...tpl.distractors],
        correctAnswers: [...tpl.correctAnswers],
        traitIds: [...traitIds],
        explanation: tpl.explanation,
      })),
      serial: 1,
      rng: () => 0.9,
      ...overrides,
    };
  }

  it('returns the fixed question when rng >= TEMPLATE_PROBABILITY', () => {
    const fixed = makeRoundQuestion({ id: 'fixed-1' });
    const selectRound = vi.fn(
      (_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [fixed],
    );
    const deps = makeDeps({ selectRound, rng: () => 0.9 });

    const result = nextQuestion(deps);

    expect(result).toBe(fixed);
  });

  it('passes count 1, filters, weights and avoidIds (containing usedIds) to selectRound', () => {
    const selectRound = vi.fn(
      (_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [
        makeRoundQuestion({ id: 'fixed-1' }),
      ],
    );
    const usedIds = new Set(['used-1', 'used-2']);
    const weights = { 'kb-1': 2 };
    const filters = { categories: ['fallacy'] as const, traitIds: ['kb-1'], weakTraits: false };
    const deps = makeDeps({ selectRound, usedIds, weights, filters, rng: () => 0.9 });

    nextQuestion(deps);

    expect(selectRound).toHaveBeenCalledWith(
      { questions: deps.questions },
      {
        count: 1,
        categories: filters.categories,
        traitIds: filters.traitIds,
        avoidIds: usedIds,
        weakTraitWeights: weights,
      },
    );
    const callArgs = selectRound.mock.calls[0][1];
    expect(callArgs.avoidIds).not.toBe(usedIds);
    expect(callArgs.avoidIds?.has('used-1')).toBe(true);
    expect(callArgs.avoidIds?.has('used-2')).toBe(true);
  });

  it('returns undefined when selectRound returns an empty array', () => {
    const selectRound = vi.fn(
      (_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [],
    );
    const deps = makeDeps({ selectRound, rng: () => 0.9 });

    expect(nextQuestion(deps)).toBeUndefined();
  });

  it('returns undefined when selectRound returns a question whose id is already in usedIds, even if templates exist', () => {
    const selectRound = vi.fn(
      (_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [
        makeRoundQuestion({ id: 'seen-1' }),
      ],
    );
    const templates = [makeTemplate({ id: 'tpl-1' })];
    const deps = makeDeps({
      selectRound,
      templates,
      usedIds: new Set(['seen-1']),
      rng: () => 0.1,
    });

    expect(nextQuestion(deps)).toBeUndefined();
  });

  it('with rng < TEMPLATE_PROBABILITY and a matching template, returns renderTemplate output with derived id and sourceTemplateId', () => {
    const fixed = makeRoundQuestion({ id: 'fixed-1' });
    const selectRound = vi.fn(
      (_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [fixed],
    );
    const kb = [makeKbEntry({ id: 'kb-1', name: 'Straw Man' })];
    const tpl = makeTemplate({ id: 'tpl-1', correctAnswers: ['Straw Man'] });
    const templates = [tpl];
    const rendered = makeRoundQuestion({ id: 'rendered', traitIds: ['kb-1'] });
    const renderTemplate = vi.fn(() => rendered);
    const deps = makeDeps({
      selectRound,
      templates,
      kb,
      renderTemplate,
      serial: 7,
      rng: () => 0.1,
    });

    const result = nextQuestion(deps);

    expect(renderTemplate).toHaveBeenCalledWith(tpl, traitIdsForAnswers(tpl.correctAnswers, kb));
    expect(result).toEqual({
      ...rendered,
      id: `${tpl.id}#7`,
      sourceTemplateId: tpl.id,
    });
  });

  it('with rng < TEMPLATE_PROBABILITY but no matching template, returns the fixed question', () => {
    const fixed = makeRoundQuestion({ id: 'fixed-1' });
    const selectRound = vi.fn(
      (_bank: QuestionBank, _options: SelectRoundOptions): RoundQuestion[] => [fixed],
    );
    const templates = [makeTemplate({ id: 'bias-only', category: 'bias' })];
    const deps = makeDeps({
      selectRound,
      templates,
      filters: { categories: ['fallacy'], weakTraits: false },
      rng: () => 0.1,
    });

    const result = nextQuestion(deps);

    expect(result).toBe(fixed);
  });

  it('exposes TEMPLATE_PROBABILITY as 0.25', () => {
    expect(TEMPLATE_PROBABILITY).toBe(0.25);
  });
});

describe('kbByName', () => {
  const strawMan = makeKbEntry({ id: 'kb-1', name: 'Straw Man' });
  const adHominem = makeKbEntry({ id: 'kb-2', name: 'Ad Hominem' });

  it('keys entries by lowercased name', () => {
    const map = kbByName([strawMan, adHominem]);

    expect([...map.keys()]).toEqual(['straw man', 'ad hominem']);
  });

  it('maps each key to its entry', () => {
    const map = kbByName([strawMan, adHominem]);

    expect(map.get('straw man')).toBe(strawMan);
    expect(map.get('ad hominem')).toBe(adHominem);
  });

  it('supports lookup with a lowercased option string', () => {
    const map = kbByName([strawMan]);

    expect(map.get('Straw Man'.toLowerCase())).toBe(strawMan);
    expect(map.get('unknown')).toBeUndefined();
  });

  it('returns an empty map for an empty kb', () => {
    expect(kbByName([]).size).toBe(0);
  });
});
