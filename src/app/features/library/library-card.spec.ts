import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { LibraryCard } from './library-card';
import { QuizCard } from './library-cards';

const entryOf = (over: Partial<QuizManifestEntry>): QuizManifestEntry => ({
  id: 'x',
  title: 'X',
  description: 'Description',
  icon: 'x',
  version: 1,
  order: 1,
  kind: 'biases',
  ...over,
});

const cardOf = (over: Partial<QuizCard>): QuizCard => ({
  entry: entryOf({}),
  kind: 'biases',
  streak: 4,
  roundsPlayed: 1,
  correct: 1,
  attempted: 2,
  accuracy: 0.5,
  skillScore: null,
  conceptsPractised: 2,
  conceptsTotal: 9,
  ...over,
});

function render(card: QuizCard): string {
  const fixture = TestBed.createComponent(LibraryCard);
  fixture.componentRef.setInput('card', card);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('LibraryCard rows', () => {
  it('shows Concepts mastered out of 18 and no streak row for the game-theory card', () => {
    const text = render(
      cardOf({
        entry: entryOf({ kind: 'game-theory', id: 'game-theory' }),
        kind: 'game-theory',
        streak: 0,
        conceptsPractised: 2,
        conceptsTotal: 18,
      }),
    );
    expect(text).toContain('Concepts mastered');
    expect(text).toContain('2 / 18');
    expect(text).not.toContain('Concepts practised');
    expect(text).not.toContain('Current streak');
  });

  it('keeps Concepts practised and the streak row for the other quizzes', () => {
    const text = render(cardOf({ kind: 'biases' }));
    expect(text).toContain('Concepts practised');
    expect(text).toContain('Current streak');
    expect(text).not.toContain('Concepts mastered');
  });
});
