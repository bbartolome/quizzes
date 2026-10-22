import { describe, it, expect, vi, beforeEach } from 'vitest';
import { optionStatus, findConfusionTips, summaryLine } from './report-logic';
import {
  Concept,
  KnowledgeBase,
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

function makeConcept(overrides: Partial<Concept> & { id: string; name: string }): Concept {
  return {
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
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
  it('matches options to concepts case-insensitively and returns the pair tip', () => {
    const kb: KnowledgeBase = {
      concepts: [
        makeConcept({ id: 'strawman', name: 'Strawman' }),
        makeConcept({ id: 'slippery-slope', name: 'Slippery Slope' }),
      ],
      pairs: [
        { concepts: ['strawman', 'slippery-slope'], tip: 'Strawman misrepresents the argument.' },
      ],
    };
    const tips = findConfusionTips(['strawman', 'SLIPPERY SLOPE'], kb);
    expect(tips).toEqual([
      { a: 'Strawman', b: 'Slippery Slope', tip: 'Strawman misrepresents the argument.' },
    ]);
  });

  it('returns one tip per pair, not one per direction', () => {
    const kb: KnowledgeBase = {
      concepts: [makeConcept({ id: 'a', name: 'A' }), makeConcept({ id: 'b', name: 'B' })],
      pairs: [{ concepts: ['a', 'b'], tip: 'A vs B.' }],
    };
    expect(findConfusionTips(['A', 'B'], kb)).toEqual([{ a: 'A', b: 'B', tip: 'A vs B.' }]);
  });

  it('emits a as the concept met first in option order, not pair definition order', () => {
    const kb: KnowledgeBase = {
      concepts: [
        makeConcept({ id: 'hasty-generalization', name: 'Hasty Generalization' }),
        makeConcept({ id: 'anchoring', name: 'Anchoring', type: 'bias' }),
      ],
      pairs: [{ concepts: ['hasty-generalization', 'anchoring'], tip: 'Hasty vs anchoring.' }],
    };
    expect(findConfusionTips(['Anchoring', 'Hasty Generalization'], kb)).toEqual([
      { a: 'Anchoring', b: 'Hasty Generalization', tip: 'Hasty vs anchoring.' },
    ]);
  });

  it('returns multiple tips in option order', () => {
    const kb: KnowledgeBase = {
      concepts: [
        makeConcept({ id: 'straw-man', name: 'Straw Man' }),
        makeConcept({ id: 'false-dilemma', name: 'False Dilemma' }),
        makeConcept({ id: 'anchoring', name: 'Anchoring', type: 'bias' }),
        makeConcept({ id: 'hasty-generalization', name: 'Hasty Generalization' }),
      ],
      pairs: [
        { concepts: ['straw-man', 'false-dilemma'], tip: 'Straw vs dilemma.' },
        { concepts: ['hasty-generalization', 'anchoring'], tip: 'Hasty vs anchoring.' },
      ],
    };
    const tips = findConfusionTips(
      ['Hasty Generalization', 'Anchoring', 'Straw Man', 'False Dilemma'],
      kb,
    );
    expect(tips).toEqual([
      { a: 'Hasty Generalization', b: 'Anchoring', tip: 'Hasty vs anchoring.' },
      { a: 'Straw Man', b: 'False Dilemma', tip: 'Straw vs dilemma.' },
    ]);
  });

  it('returns nothing when only one side of a pair is an option', () => {
    const kb: KnowledgeBase = {
      concepts: [
        makeConcept({ id: 'strawman', name: 'Strawman' }),
        makeConcept({ id: 'slippery-slope', name: 'Slippery Slope' }),
      ],
      pairs: [{ concepts: ['strawman', 'slippery-slope'], tip: 'tip' }],
    };
    expect(findConfusionTips(['Strawman'], kb)).toEqual([]);
  });

  it('skips a pair that has no tip', () => {
    const kb: KnowledgeBase = {
      concepts: [makeConcept({ id: 'a', name: 'A' }), makeConcept({ id: 'b', name: 'B' })],
      pairs: [{ concepts: ['a', 'b'] }],
    };
    expect(findConfusionTips(['A', 'B'], kb)).toEqual([]);
  });

  it('returns an empty array when no options match any concept', () => {
    const kb: KnowledgeBase = {
      concepts: [makeConcept({ id: 'strawman', name: 'Strawman' })],
      pairs: [],
    };
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
