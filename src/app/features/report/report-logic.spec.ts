import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optionStatus, findConfusionTips, summaryLine } from './report-logic';
import {
  KnowledgeBaseEntry,
  RoundQuestion,
  ScoredQuestionResult,
} from '../../core/models/quiz.models';

function makeQuestion(overrides: Partial<RoundQuestion> & { id: string }): RoundQuestion {
  return {
    prompt: `Prompt for ${overrides.id}`,
    options: ['Alpha', 'Beta', 'Gamma'],
    correctAnswers: ['Alpha'],
    traitIds: [],
    explanation: `Explanation for ${overrides.id}`,
    ...overrides,
  };
}

function makeResult(overrides: Partial<ScoredQuestionResult> = {}): ScoredQuestionResult {
  return {
    question: makeQuestion({ id: 'q1' }),
    selected: [],
    correct: false,
    missed: [],
    extra: [],
    ...overrides,
  };
}

function makeKbEntry(
  overrides: Partial<KnowledgeBaseEntry> & { id: string; name: string },
): KnowledgeBaseEntry {
  return {
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
    ...overrides,
  };
}

describe('optionStatus', () => {
  it('returns "wrong" for an option in extra', () => {
    const result = makeResult({ extra: ['Beta'] });
    expect(optionStatus(result, 'Beta')).toBe('wrong');
  });

  it('returns "missed" for an option in missed', () => {
    const result = makeResult({ missed: ['Alpha'] });
    expect(optionStatus(result, 'Alpha')).toBe('missed');
  });

  it('returns "correct" for an option that is selected and in correctAnswers', () => {
    const result = makeResult({ selected: ['Alpha'] });
    expect(optionStatus(result, 'Alpha')).toBe('correct');
  });

  it('returns "neutral" for an option that is none of the above', () => {
    const result = makeResult({ selected: ['Alpha'] });
    expect(optionStatus(result, 'Gamma')).toBe('neutral');
  });

  it('prioritizes "wrong" over other classifications when option is in extra', () => {
    const result = makeResult({ extra: ['Alpha'], selected: ['Alpha'] });
    expect(optionStatus(result, 'Alpha')).toBe('wrong');
  });
});

describe('findConfusionTips', () => {
  it('matches options to kb entries case-insensitively and returns a tip for a confused pair', () => {
    const kb: KnowledgeBaseEntry[] = [
      makeKbEntry({
        id: 'strawman',
        name: 'Strawman',
        commonlyConfusedWith: ['slippery-slope'],
        distinguishingTip: 'Strawman misrepresents the argument.',
      }),
      makeKbEntry({ id: 'slippery-slope', name: 'Slippery Slope' }),
    ];
    const tips = findConfusionTips(['strawman', 'SLIPPERY SLOPE'], kb);
    expect(tips).toEqual([
      { a: 'Strawman', b: 'Slippery Slope', tip: 'Strawman misrepresents the argument.' },
    ]);
  });

  it('returns one tip per unordered pair, keeping the first match', () => {
    const kb: KnowledgeBaseEntry[] = [
      makeKbEntry({
        id: 'a',
        name: 'A',
        commonlyConfusedWith: ['b'],
        distinguishingTip: 'A vs B from A.',
      }),
      makeKbEntry({
        id: 'b',
        name: 'B',
        commonlyConfusedWith: ['a'],
        distinguishingTip: 'B vs A from B.',
      }),
    ];
    const tips = findConfusionTips(['A', 'B'], kb);
    expect(tips).toEqual([{ a: 'A', b: 'B', tip: 'A vs B from A.' }]);
  });

  it('omits entries whose commonlyConfusedWith id is not present in the matched options', () => {
    const kb: KnowledgeBaseEntry[] = [
      makeKbEntry({
        id: 'strawman',
        name: 'Strawman',
        commonlyConfusedWith: ['ad-hominem'],
        distinguishingTip: 'tip',
      }),
    ];
    const tips = findConfusionTips(['Strawman'], kb);
    expect(tips).toEqual([]);
  });

  it('returns an empty array when no options match any kb entry', () => {
    const kb: KnowledgeBaseEntry[] = [makeKbEntry({ id: 'strawman', name: 'Strawman' })];
    expect(findConfusionTips(['Unrelated Option'], kb)).toEqual([]);
  });
});

describe('summaryLine', () => {
  let beforeEachRan = false;
  beforeEach(() => {
    beforeEachRan = true;
  });

  it('counts how many results are correct out of the total', () => {
    const results = [
      makeResult({ correct: true }),
      makeResult({ correct: false }),
      makeResult({ correct: true }),
    ];
    expect(summaryLine(results)).toBe('2 of 3 correct');
    expect(beforeEachRan).toBe(true);
  });

  it('returns "0 of 0 correct" for an empty results array', () => {
    expect(summaryLine([])).toBe('0 of 0 correct');
  });
});
