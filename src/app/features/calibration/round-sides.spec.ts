import { describe, it, expect } from 'vitest';
import {
  fourWayBankPick,
  fourWayScreenChoice,
  screenOptions,
  twoWayBankPick,
  twoWayScreenSelection,
} from './round-sides';
import { FourWayChoice } from './calibration.models';

const CHOICES: FourWayChoice[] = ['neither', 'a', 'b', 'both'];

describe('screenOptions', () => {
  it('keeps bank order when not swapped', () => {
    expect(screenOptions(['x', 'y'], false)).toEqual(['x', 'y']);
  });

  it('reverses the options when swapped', () => {
    expect(screenOptions(['x', 'y'], true)).toEqual(['y', 'x']);
  });

  it('does not mutate the input', () => {
    const options: [string, string] = ['x', 'y'];
    screenOptions(options, true);
    expect(options).toEqual(['x', 'y']);
  });
});

describe('twoWayBankPick', () => {
  it('maps the on-screen side straight through when not swapped', () => {
    expect(twoWayBankPick(0, false)).toBe(0);
    expect(twoWayBankPick(1, false)).toBe(1);
  });

  it('flips the side when swapped', () => {
    expect(twoWayBankPick(0, true)).toBe(1);
    expect(twoWayBankPick(1, true)).toBe(0);
  });
});

describe('twoWayScreenSelection', () => {
  it('returns the bank pick as the on-screen side when not swapped', () => {
    expect(twoWayScreenSelection(1, 80, false)).toEqual({ side: 1, confidence: 80 });
    expect(twoWayScreenSelection(0, 70, false)).toEqual({ side: 0, confidence: 70 });
  });

  it('flips the side when swapped', () => {
    expect(twoWayScreenSelection(1, 80, true)).toEqual({ side: 0, confidence: 80 });
    expect(twoWayScreenSelection(0, 70, true)).toEqual({ side: 1, confidence: 70 });
  });

  it('always shows 50% on side 0, swapped or not', () => {
    expect(twoWayScreenSelection(0, 50, false)).toEqual({ side: 0, confidence: 50 });
    expect(twoWayScreenSelection(1, 50, false)).toEqual({ side: 0, confidence: 50 });
    expect(twoWayScreenSelection(0, 50, true)).toEqual({ side: 0, confidence: 50 });
    expect(twoWayScreenSelection(1, 50, true)).toEqual({ side: 0, confidence: 50 });
  });

  it('inverts twoWayBankPick for non-50 confidences', () => {
    for (const swapped of [false, true]) {
      for (const side of [0, 1] as const) {
        const pick = twoWayBankPick(side, swapped);
        expect(twoWayScreenSelection(pick, 90, swapped).side).toBe(side);
      }
    }
  });
});

describe('fourWayBankPick', () => {
  it('maps choices to bank order when not swapped', () => {
    expect(fourWayBankPick('neither', false)).toEqual([false, false]);
    expect(fourWayBankPick('a', false)).toEqual([true, false]);
    expect(fourWayBankPick('b', false)).toEqual([false, true]);
    expect(fourWayBankPick('both', false)).toEqual([true, true]);
  });

  it('exchanges A and B when swapped', () => {
    expect(fourWayBankPick('a', true)).toEqual([false, true]);
    expect(fourWayBankPick('b', true)).toEqual([true, false]);
  });

  it('leaves Neither and Both unchanged by the swap', () => {
    expect(fourWayBankPick('neither', true)).toEqual([false, false]);
    expect(fourWayBankPick('both', true)).toEqual([true, true]);
  });
});

describe('fourWayScreenChoice', () => {
  it('maps bank picks to on-screen choices when not swapped', () => {
    expect(fourWayScreenChoice([true, false], false)).toBe('a');
    expect(fourWayScreenChoice([false, true], false)).toBe('b');
  });

  it('exchanges A and B when swapped', () => {
    expect(fourWayScreenChoice([true, false], true)).toBe('b');
    expect(fourWayScreenChoice([false, true], true)).toBe('a');
  });

  it('leaves Neither and Both unchanged by the swap', () => {
    expect(fourWayScreenChoice([false, false], true)).toBe('neither');
    expect(fourWayScreenChoice([true, true], true)).toBe('both');
  });

  it.each(CHOICES.flatMap((choice) => [false, true].map((swapped) => [choice, swapped] as const)))(
    'is the inverse of fourWayBankPick for %s (swapped %s)',
    (choice, swapped) => {
      expect(fourWayScreenChoice(fourWayBankPick(choice, swapped), swapped)).toBe(choice);
    },
  );
});
