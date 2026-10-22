import { describe, it, expect } from 'vitest';
import { buildFeedback } from './feedback';
import { Concept, ConfusedPair, KnowledgeBase } from '../../core/models/quiz.models';

const T: Concept = {
  id: 't',
  name: 'Target',
  type: 'fallacy',
  shortDefinition: 'target definition',
  longExplanation: 'target long explanation',
  example: 'target example',
  spottingTip: 'spot-T',
};
const P1: Concept = {
  id: 'p1',
  name: 'Pick One',
  type: 'fallacy',
  shortDefinition: 'pick one definition',
  longExplanation: 'p1 long',
  example: 'p1 example',
  spottingTip: 'spot-P1',
};
const P2: Concept = {
  id: 'p2',
  name: 'Pick Two',
  type: 'fallacy',
  shortDefinition: 'pick two definition',
  longExplanation: 'p2 long',
  example: 'p2 example',
};
const X: Concept = {
  id: 'x',
  name: 'Other',
  type: 'fallacy',
  shortDefinition: 'other definition',
  longExplanation: 'x long',
  example: 'x example',
};

const TP1: ConfusedPair = { concepts: ['t', 'p1'], tip: 'tip-TP1' };
const TP2: ConfusedPair = { concepts: ['t', 'p2'], tip: 'tip-TP2' };
const P1P2: ConfusedPair = { concepts: ['p1', 'p2'], tip: 'tip-P1P2' };

function kbWith(...pairs: ConfusedPair[]): KnowledgeBase {
  return { concepts: [T, P1, P2, X], pairs };
}

const allOptions = [T, P1, P2, X];

describe('buildFeedback', () => {
  describe('red behaviours', () => {
    it('1. correct pick gives Correct, the answer and the long explanation', () => {
      const feedback = buildFeedback(T, null, allOptions, kbWith(TP1, TP2, P1P2));

      expect(feedback.verdict).toBe('Correct');
      expect(feedback.answer).toBe('Target');
      expect(feedback.explanation).toBe('target long explanation');
    });

    it('2. wrong pick gives Incorrect with the answer', () => {
      const feedback = buildFeedback(T, P1, allOptions, kbWith(TP1, TP2, P1P2));

      expect(feedback.verdict).toBe('Incorrect');
      expect(feedback.answer).toBe('Target');
    });

    it('3. includes the target spotting tip when it has one', () => {
      const feedback = buildFeedback(T, null, allOptions, kbWith(TP1, TP2, P1P2));

      expect(feedback.spottingTip).toBe('spot-T');
    });

    it('4. has no spotting tip when the target has none', () => {
      const feedback = buildFeedback(P2, null, allOptions, kbWith(TP1, TP2, P1P2));

      expect(feedback.spottingTip).toBeUndefined();
    });

    it('5. wrong pick with a pair tip gives a pair-tip contrast', () => {
      const feedback = buildFeedback(T, P1, allOptions, kbWith(TP1, TP2, P1P2));

      expect(feedback.contrast).toEqual({
        kind: 'pair-tip',
        target: 'Target',
        lure: 'Pick One',
        tip: 'tip-TP1',
      });
    });

    it('6. a pair stored as [lure, target] still gives a target-first contrast', () => {
      const stored: ConfusedPair = { concepts: ['p1', 't'], tip: 'tip-TP1' };

      const feedback = buildFeedback(T, P1, allOptions, kbWith(stored));

      expect(feedback.contrast).toEqual({
        kind: 'pair-tip',
        target: 'Target',
        lure: 'Pick One',
        tip: 'tip-TP1',
      });
    });

    it('7. wrong pick with a tipless pair gives side-by-side with the lure', () => {
      const tipless: ConfusedPair = { concepts: ['t', 'p2'] };

      const feedback = buildFeedback(T, P2, allOptions, kbWith(tipless));

      expect(feedback.contrast.kind).toBe('side-by-side');
      expect(feedback.contrast).toEqual({ kind: 'side-by-side', lure: P2 });
      expect(
        feedback.contrast.kind === 'side-by-side' ? feedback.contrast.lureSpottingTip : 'n/a',
      ).toBeUndefined();
    });

    it('8. wrong pick with no pair gives side-by-side with the lure', () => {
      const feedback = buildFeedback(T, X, allOptions, kbWith());

      expect(feedback.contrast).toEqual({ kind: 'side-by-side', lure: X });
    });

    it('9. side-by-side includes the lure spotting tip when it has one', () => {
      const feedback = buildFeedback(T, P1, allOptions, kbWith(P1P2));

      expect(feedback.contrast).toEqual({
        kind: 'side-by-side',
        lure: P1,
        lureSpottingTip: 'spot-P1',
      });
    });

    it('10. side-by-side has no lure spotting tip when the lure has none', () => {
      const feedback = buildFeedback(T, P2, allOptions, kbWith(P1P2));

      expect(feedback.contrast.kind).toBe('side-by-side');
      expect(
        feedback.contrast.kind === 'side-by-side' ? feedback.contrast.lureSpottingTip : 'n/a',
      ).toBeUndefined();
    });

    it('11. option-order test: the first partner in option order wins over pairs order', () => {
      // Options put P2 before P1; kb.pairs lists TP1 first.
      const options = [T, P2, X, P1];

      const feedback = buildFeedback(T, null, options, kbWith(TP1, TP2, P1P2));

      expect(feedback.contrast).toEqual({ kind: 'correct-tip', tip: 'tip-TP2' });
    });

    it('12. a tipless pair is skipped, so the next tipped partner in option order is used', () => {
      const tiplessTP2: ConfusedPair = { concepts: ['t', 'p2'] };
      const options = [T, P2, X, P1];

      const feedback = buildFeedback(T, null, options, kbWith(tiplessTP2, TP1));

      expect(feedback.contrast).toEqual({ kind: 'correct-tip', tip: 'tip-TP1' });
    });

    it('13. correct pick uses the partner tip when the partner comes first in options', () => {
      const options = [T, P1, X, P2];

      const feedback = buildFeedback(T, null, options, kbWith(TP1));

      expect(feedback.contrast).toEqual({ kind: 'correct-tip', tip: 'tip-TP1' });
    });

    it('14. with no partner among the options, uses the first tipped pair of the target in pairs order', () => {
      const options = [T, X];

      const feedback = buildFeedback(T, null, options, kbWith(TP2, TP1, P1P2));

      expect(feedback.contrast).toEqual({ kind: 'correct-tip', tip: 'tip-TP2' });
    });

    it('15. with no partner among the options, skips a tipless pair of the target', () => {
      const tiplessTP1: ConfusedPair = { concepts: ['t', 'p1'] };
      const options = [T, X];

      const feedback = buildFeedback(T, null, options, kbWith(tiplessTP1, TP2));

      expect(feedback.contrast).toEqual({ kind: 'correct-tip', tip: 'tip-TP2' });
    });

    it('16. with only tipless pairs and no partner among the options, gives none', () => {
      const tiplessTP1: ConfusedPair = { concepts: ['t', 'p1'] };
      const tiplessTP2: ConfusedPair = { concepts: ['t', 'p2'] };
      const options = [T, X];

      const feedback = buildFeedback(T, null, options, kbWith(tiplessTP1, tiplessTP2));

      expect(feedback.contrast).toEqual({ kind: 'none' });
    });

    it('17. with no pairs at all, a correct pick gives none', () => {
      const feedback = buildFeedback(T, null, [T, X], kbWith());

      expect(feedback.contrast).toEqual({ kind: 'none' });
    });

    it('18. is pure: repeated calls match and inputs are not mutated', () => {
      const kb = kbWith(TP1, TP2, P1P2);
      const options = [T, P2, X, P1];
      const kbBefore = structuredClone(kb);
      const optionsBefore = structuredClone(options);

      const first = buildFeedback(T, null, options, kb);
      const second = buildFeedback(T, null, options, kb);

      expect(second).toEqual(first);
      expect(kb).toEqual(kbBefore);
      expect(options).toEqual(optionsBefore);
    });
  });
});
