import { describe, it, expect } from 'vitest';
import { filterEntries, confusedWith } from './glossary-search';
import { KnowledgeBaseEntry } from '../../core/models/quiz.models';

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
  it('resolves commonlyConfusedWith ids to kb entries in order', () => {
    const b = makeKbEntry({ id: 'b', name: 'Slippery Slope' });
    const c = makeKbEntry({ id: 'c', name: 'False Cause' });
    const entry = makeKbEntry({ id: 'a', name: 'Straw Man', commonlyConfusedWith: ['b', 'c'] });
    const kb = [entry, b, c];

    expect(confusedWith(entry, kb)).toEqual([b, c]);
  });

  it('preserves the order given in commonlyConfusedWith even when kb order differs', () => {
    const b = makeKbEntry({ id: 'b', name: 'Slippery Slope' });
    const c = makeKbEntry({ id: 'c', name: 'False Cause' });
    const entry = makeKbEntry({ id: 'a', name: 'Straw Man', commonlyConfusedWith: ['c', 'b'] });
    const kb = [entry, b, c];

    expect(confusedWith(entry, kb)).toEqual([c, b]);
  });

  it('skips ids that are not found in the kb', () => {
    const b = makeKbEntry({ id: 'b', name: 'Slippery Slope' });
    const entry = makeKbEntry({
      id: 'a',
      name: 'Straw Man',
      commonlyConfusedWith: ['missing', 'b'],
    });
    const kb = [entry, b];

    expect(confusedWith(entry, kb)).toEqual([b]);
  });

  it('returns an empty array when commonlyConfusedWith is empty', () => {
    const entry = makeKbEntry({ id: 'a', name: 'Straw Man', commonlyConfusedWith: [] });
    const kb = [entry];

    expect(confusedWith(entry, kb)).toEqual([]);
  });
});
