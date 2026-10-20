import { describe, expect, it } from 'vitest';
import { FourWayItem, TwoWayItem } from './calibration.models';
import { correctPick, pickLabel } from './pick-label';

const source = { label: 'Wikipedia', url: 'https://en.wikipedia.org/' };

const twoWay: TwoWayItem = {
  id: 's001',
  prompt: 'Which is larger?',
  options: ['Whale', 'Shark'],
  correct: 1,
  topic: 'nature',
  fact: 'A fact.',
  source,
};

const fourWay: FourWayItem = {
  id: 'a001',
  prompt: 'Which of these is a mammal?',
  options: ['Platypus', 'Penguin'],
  truth: [true, false],
  topic: 'nature',
  facts: ['Platypus fact.', 'Penguin fact.'],
  source,
};

describe('pickLabel', () => {
  it('returns the first option text for two-way pick 0', () => {
    expect(pickLabel(twoWay, 0)).toBe('Whale');
  });

  it('returns the second option text for two-way pick 1', () => {
    expect(pickLabel(twoWay, 1)).toBe('Shark');
  });

  it('labels four-way [false, false] as Neither', () => {
    expect(pickLabel(fourWay, [false, false])).toBe('Neither');
  });

  it('labels four-way [true, false] with the first option', () => {
    expect(pickLabel(fourWay, [true, false])).toBe('Platypus');
  });

  it('labels four-way [false, true] with the second option', () => {
    expect(pickLabel(fourWay, [false, true])).toBe('Penguin');
  });

  it('labels four-way [true, true] as Both', () => {
    expect(pickLabel(fourWay, [true, true])).toBe('Both');
  });
});

describe('correctPick', () => {
  it('returns item.correct for a two-way item', () => {
    expect(correctPick(twoWay)).toBe(1);
  });

  it('returns item.truth for a four-way item', () => {
    expect(correctPick(fourWay)).toEqual([true, false]);
  });

  it('feeds pickLabel to give the correct answer text', () => {
    expect(pickLabel(twoWay, correctPick(twoWay))).toBe('Shark');
    expect(pickLabel(fourWay, correctPick(fourWay))).toBe('Platypus');
  });
});
