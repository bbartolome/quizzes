import { describe, it, expect } from 'vitest';
import { BACK_LABELS, ReportResult, buildReportSummary, isReportEmpty } from './report-summary';

const names = new Map<string, string>([
  ['anchoring', 'Anchoring'],
  ['hasty-generalization', 'Hasty generalization'],
  ['straw-man', 'Straw man'],
]);

describe('buildReportSummary', () => {
  it('counts correct results as n', () => {
    const results: ReportResult[] = [
      { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
      { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
      { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
    ];

    expect(buildReportSummary(results, names).n).toBe(2);
  });

  it('counts all results as m', () => {
    const results: ReportResult[] = [
      { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
      { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
    ];

    expect(buildReportSummary(results, names).m).toBe(2);
  });

  it('lists only the wrong results as missed', () => {
    const results: ReportResult[] = [
      { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
      { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
    ];

    expect(buildReportSummary(results, names).missed).toEqual([
      { targetName: 'Straw man', lureName: 'Hasty generalization' },
    ]);
  });

  it('shows a repeated wrong (target, lure) pair once, at its first miss', () => {
    const results: ReportResult[] = [
      { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
      { targetId: 'anchoring', pickedId: 'hasty-generalization', correct: false },
      { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
    ];

    expect(buildReportSummary(results, names).missed).toEqual([
      { targetName: 'Straw man', lureName: 'Hasty generalization' },
      { targetName: 'Anchoring', lureName: 'Hasty generalization' },
    ]);
  });

  it('keeps the first-miss order of the wrong cards', () => {
    const results: ReportResult[] = [
      { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
      { targetId: 'anchoring', pickedId: 'straw-man', correct: false },
    ];

    expect(buildReportSummary(results, names).missed.map((m) => m.targetName)).toEqual([
      'Straw man',
      'Anchoring',
    ]);
  });

  it('does not confuse a pair with an id that contains a separator character', () => {
    const tricky = new Map<string, string>([
      ['a|b', 'AB'],
      ['c', 'C'],
      ['a', 'A'],
      ['b|c', 'BC'],
    ]);
    const results: ReportResult[] = [
      { targetId: 'a|b', pickedId: 'c', correct: false },
      { targetId: 'a', pickedId: 'b|c', correct: false },
    ];

    expect(buildReportSummary(results, tricky).missed).toHaveLength(2);
  });

  it('falls back to the raw id when a name is missing from the lookup', () => {
    const results: ReportResult[] = [
      { targetId: 'unknown-target', pickedId: 'anchoring', correct: false },
    ];

    expect(buildReportSummary(results, names).missed).toEqual([
      { targetName: 'unknown-target', lureName: 'Anchoring' },
    ]);
  });

  it('gives no missed lines for a perfect round', () => {
    const results: ReportResult[] = [
      { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
    ];

    expect(buildReportSummary(results, names).missed).toEqual([]);
  });
});

describe('isReportEmpty', () => {
  it('is true with no results', () => {
    expect(isReportEmpty([])).toBe(true);
  });

  it('is false with one result', () => {
    expect(isReportEmpty([{ targetId: 'anchoring', pickedId: 'anchoring', correct: true }])).toBe(
      false,
    );
  });
});

describe('BACK_LABELS', () => {
  it('labels the bias back action', () => {
    expect(BACK_LABELS.bias).toBe('Back to Biases');
  });

  it('labels the fallacy back action', () => {
    expect(BACK_LABELS.fallacy).toBe('Back to Fallacies');
  });
});
