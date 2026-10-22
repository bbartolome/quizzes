import { describe, it, expect } from 'vitest';
import { filterEntries, confusedWith, pairTip } from './glossary-search';
import { Concept, KnowledgeBase } from '../../core/models/quiz.models';

function makeKbEntry(overrides: Partial<Concept> & { id: string }): Concept {
  return {
    name: overrides.id,
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    ...overrides,
  };
}

describe('filterEntries', () => {
  it('returns all entries, in order, when the query is empty', () => {
    const kb = [
      makeKbEntry({ id: 'a', name: 'Straw Man' }),
      makeKbEntry({ id: 'b', name: 'Ad Hominem' }),
    ];

    expect(filterEntries(kb, '')).toEqual(kb);
  });

  it('returns all entries when the query is only whitespace', () => {
    const kb = [
      makeKbEntry({ id: 'a', name: 'Straw Man' }),
      makeKbEntry({ id: 'b', name: 'Ad Hominem' }),
    ];

    expect(filterEntries(kb, '   ')).toEqual(kb);
  });

  it('matches a case-insensitive substring of name', () => {
    const kb = [
      makeKbEntry({ id: 'a', name: 'Straw Man' }),
      makeKbEntry({ id: 'b', name: 'Ad Hominem' }),
    ];

    const result = filterEntries(kb, 'straw');

    expect(result).toEqual([kb[0]]);
  });

  it('matches a case-insensitive substring of shortDefinition', () => {
    const kb = [
      makeKbEntry({ id: 'a', name: 'Straw Man', shortDefinition: 'Misrepresents an argument' }),
      makeKbEntry({ id: 'b', name: 'Ad Hominem', shortDefinition: 'Attacks the person' }),
    ];

    const result = filterEntries(kb, 'MISREPRESENTS');

    expect(result).toEqual([kb[0]]);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    const kb = [makeKbEntry({ id: 'a', name: 'Straw Man' })];

    expect(filterEntries(kb, '  straw  ')).toEqual(kb);
  });

  it('preserves the original kb order among matches', () => {
    const kb = [
      makeKbEntry({ id: 'a', name: 'Appeal to Authority' }),
      makeKbEntry({ id: 'b', name: 'Bandwagon Appeal' }),
      makeKbEntry({ id: 'c', name: 'No Match Here' }),
    ];

    const result = filterEntries(kb, 'appeal');

    expect(result).toEqual([kb[0], kb[1]]);
  });

  it('returns an empty array when nothing matches', () => {
    const kb = [makeKbEntry({ id: 'a', name: 'Straw Man' })];

    expect(filterEntries(kb, 'nonexistent')).toEqual([]);
  });
});

describe('confusedWith', () => {
  const straw = makeKbEntry({ id: 'straw', name: 'Straw Man' });
  const dilemma = makeKbEntry({ id: 'dilemma', name: 'False Dilemma' });
  const slope = makeKbEntry({ id: 'slope', name: 'Slippery Slope' });
  const cause = makeKbEntry({ id: 'cause', name: 'False Cause' });

  it('returns the partner from a pair in either direction', () => {
    const kb: KnowledgeBase = {
      concepts: [straw, dilemma],
      pairs: [{ concepts: ['straw', 'dilemma'] }],
    };

    expect(confusedWith(straw, kb)).toEqual([dilemma]);
    expect(confusedWith(dilemma, kb)).toEqual([straw]);
  });

  it('returns an empty array when the concept is in no pair', () => {
    const kb: KnowledgeBase = {
      concepts: [straw, dilemma, slope],
      pairs: [{ concepts: ['straw', 'dilemma'] }],
    };

    expect(confusedWith(slope, kb)).toEqual([]);
  });

  it('returns every partner in pairs order', () => {
    const kb: KnowledgeBase = {
      concepts: [straw, dilemma, slope, cause],
      pairs: [
        { concepts: ['straw', 'slope'] },
        { concepts: ['cause', 'straw'] },
        { concepts: ['dilemma', 'cause'] },
      ],
    };

    expect(confusedWith(straw, kb)).toEqual([slope, cause]);
  });

  it('skips a pair whose partner is not in the concepts', () => {
    const kb: KnowledgeBase = {
      concepts: [straw],
      pairs: [{ concepts: ['straw', 'missing'] }],
    };

    expect(confusedWith(straw, kb)).toEqual([]);
  });
});

describe('pairTip', () => {
  const kb: KnowledgeBase = {
    concepts: [
      makeKbEntry({ id: 'straw', name: 'Straw Man' }),
      makeKbEntry({ id: 'dilemma', name: 'False Dilemma' }),
      makeKbEntry({ id: 'slope', name: 'Slippery Slope' }),
    ],
    pairs: [
      { concepts: ['straw', 'dilemma'], tip: 'Straw misrepresents; dilemma narrows.' },
      { concepts: ['straw', 'slope'] },
    ],
  };

  it('returns the tip for a pair in either order', () => {
    expect(pairTip('straw', 'dilemma', kb)).toBe('Straw misrepresents; dilemma narrows.');
    expect(pairTip('dilemma', 'straw', kb)).toBe('Straw misrepresents; dilemma narrows.');
  });

  it('returns undefined for a pair with no tip', () => {
    expect(pairTip('straw', 'slope', kb)).toBeUndefined();
  });

  it('returns undefined when the two concepts are not paired', () => {
    expect(pairTip('dilemma', 'slope', kb)).toBeUndefined();
  });
});
