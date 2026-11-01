import { describe, it, expect } from 'vitest';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { QuizCard } from './library-cards';
import { summarize } from './library-summary';

const entry = (id: string): QuizManifestEntry => ({
  id,
  title: id,
  description: '',
  icon: 'x',
  version: 1,
  order: 1,
  kind: 'biases',
});

const card = (id: string, over: Partial<QuizCard> = {}): QuizCard => ({
  entry: entry(id),
  kind: 'biases',
  streak: 0,
  roundsPlayed: 0,
  correct: 0,
  attempted: 0,
  accuracy: null,
  skillScore: null,
  ...over,
});

describe('summarize', () => {
  it('is empty when there are no cards', () => {
    expect(summarize([])).toEqual({ totalRounds: 0, accuracy: null, recentlyPlayed: null });
  });

  it('totals rounds and derives accuracy as a fraction across all cards', () => {
    const summary = summarize([
      card('a', { roundsPlayed: 2, correct: 3, attempted: 4 }),
      card('b', { roundsPlayed: 1, correct: 1, attempted: 4 }),
    ]);

    expect(summary.totalRounds).toBe(3);
    expect(summary.accuracy).toBe(0.5);
  });

  it('leaves accuracy null when nothing was attempted (calibration cards)', () => {
    expect(summarize([card('a', { kind: 'calibration', roundsPlayed: 3 })]).accuracy).toBeNull();
  });

  it('picks the highest streak as most recently played', () => {
    const summary = summarize([
      card('low', { streak: 2, roundsPlayed: 9 }),
      card('high', { streak: 5, roundsPlayed: 1 }),
    ]);

    expect(summary.recentlyPlayed?.entry.id).toBe('high');
  });

  it('breaks a streak tie on rounds played', () => {
    const summary = summarize([
      card('fewer', { streak: 3, roundsPlayed: 4 }),
      card('more', { streak: 3, roundsPlayed: 9 }),
    ]);

    expect(summary.recentlyPlayed?.entry.id).toBe('more');
  });

  it('keeps the first card when streak and rounds both tie', () => {
    const summary = summarize([
      card('first', { streak: 1, roundsPlayed: 1 }),
      card('second', { streak: 1, roundsPlayed: 1 }),
    ]);

    expect(summary.recentlyPlayed?.entry.id).toBe('first');
  });

  it('names a zero-streak card when it is the only one', () => {
    expect(summarize([card('only')]).recentlyPlayed?.entry.id).toBe('only');
  });
});
