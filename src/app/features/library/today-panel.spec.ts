import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { PracticeSnapshot } from '../../core/models/practice.models';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { PracticeService } from '../../core/services/practice.service';
import { FakePracticeService } from '../../../testing/fake-practice.service';
import { provideFixedClock } from '../../../testing/fixed-clock';
import { QuizCard } from './library-cards';
import { TodayPanel } from './today-panel';

const entry = (id: string, title: string): QuizManifestEntry => ({
  id,
  title,
  description: '',
  icon: 'x',
  version: 1,
  order: 1,
  kind: 'biases',
});

const card = (id: string, title: string): QuizCard => ({
  entry: entry(id, title),
  kind: 'biases',
  streak: 0,
  roundsPlayed: 0,
  correct: 0,
  attempted: 0,
  accuracy: null,
  skillScore: null,
});

const snapshot = (over: Partial<PracticeSnapshot> = {}): PracticeSnapshot => ({
  enabled: true,
  streak: 3,
  longest: 5,
  restDays: 1,
  practicedToday: true,
  attemptsToday: 5,
  ...over,
});

/** Local noon on 2026-11-02, so the seven-local-day window is 2026-10-27 to 2026-11-02. */
const NOW = '2026-11-02T12:00:00';

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('TodayPanel', () => {
  let practice: FakePracticeService;

  beforeEach(() => {
    practice = new FakePracticeService();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideFixedClock(NOW),
        { provide: PracticeService, useValue: practice },
      ],
    });
  });

  function render(cards: QuizCard[]) {
    const fixture = TestBed.createComponent(TodayPanel);
    fixture.componentRef.setInput('cards', cards);
    fixture.detectChanges();
    return fixture;
  }

  function el(fixture: { nativeElement: unknown }, testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
  }

  it('shows the practice streak and rest days when the layer is on', () => {
    practice.seed({ snapshot: snapshot({ streak: 3, restDays: 1 }) });
    const fixture = render([]);

    expect(text(el(fixture, 'practice-streak'))).toContain('3');
    expect(text(el(fixture, 'rest-days'))).toContain('1');
  });

  it('says to practise today instead of showing a zero streak', () => {
    practice.seed({ snapshot: snapshot({ streak: 0 }) });
    const fixture = render([]);

    expect(text(fixture.nativeElement)).toContain('Practise today to start a streak');
  });

  it('hides the streak and rest days when the layer is off, and checks the toggle', () => {
    practice.seed({ snapshot: snapshot({ enabled: false }) });
    const fixture = render([]);

    expect(el(fixture, 'practice-streak')).toBeNull();
    expect(el(fixture, 'rest-days')).toBeNull();
    expect((el(fixture, 'hide-streak-toggle') as HTMLInputElement).checked).toBe(true);
  });

  it('labels the toggle "Hide streak and badges" as a native checkbox', () => {
    const fixture = render([]);
    const toggle = el(fixture, 'hide-streak-toggle') as HTMLInputElement;

    expect(toggle.type).toBe('checkbox');
    expect(text(toggle.closest('label'))).toContain('Hide streak and badges');
  });

  it('turns the layer off through PracticeService.setEnabled when toggled', () => {
    const fixture = render([]);

    (el(fixture, 'hide-streak-toggle') as HTMLInputElement).click();
    fixture.detectChanges();

    expect(practice.snapshot().enabled).toBe(false);
  });

  it('suggests a quiz that has never been played before one that has', () => {
    practice.seed({ lastPlayed: { traps: new Date(2026, 9, 1, 10).toISOString() } });
    const fixture = render([card('traps', 'Reasoning Traps'), card('biases', 'Biases')]);

    expect(el(fixture, 'suggested-today')!.getAttribute('href')).toMatch(/\/biases\/biases$/);
  });

  it('suggests the quiz with the oldest lastPlayed', () => {
    practice.seed({
      lastPlayed: {
        a: new Date(2026, 9, 20, 10).toISOString(),
        b: new Date(2026, 9, 1, 10).toISOString(),
        c: new Date(2026, 9, 25, 10).toISOString(),
      },
    });
    const fixture = render([card('a', 'A'), card('b', 'B'), card('c', 'C')]);

    expect(el(fixture, 'suggested-today')!.getAttribute('href')).toMatch(/\/biases\/b$/);
  });

  it('lists quizzes played in the last seven local days under This week', () => {
    practice.seed({
      lastPlayed: {
        inside: new Date(2026, 9, 27, 9).toISOString(),
        outside: new Date(2026, 9, 26, 23).toISOString(),
      },
    });
    const fixture = render([card('inside', 'Inside Quiz'), card('outside', 'Outside Quiz')]);
    const week = text(el(fixture, 'this-week'));

    expect(week).toContain('Inside Quiz');
    expect(week).not.toContain('Outside Quiz');
  });

  it('shows the save failure message only when saveFailed is true', () => {
    const fixture = render([]);
    expect(text(fixture.nativeElement)).not.toContain("Progress can't be saved in this browser.");

    practice.setSaveFailed(true);
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toContain("Progress can't be saved in this browser.");
  });
});
