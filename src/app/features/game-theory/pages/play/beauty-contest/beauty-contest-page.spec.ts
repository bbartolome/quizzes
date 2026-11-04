import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BeautyContestPage } from './beauty-contest-page';
import { APP_CLOCK } from '../../../../../core/app-clock';
import { defaultBeautyConfig, runBeautyContest } from '../../../lib/beauty';

const NOW = new Date('2026-11-03T12:00:00Z');
const LABELS = ['L0', 'L1', 'L2', 'L3', 'L4+'] as const;
const EQUILIBRIUM_SENTENCE = '0 is the equilibrium but not the winning guess';
const MODEL_LABEL = 'Simulated players (a model, not real people)';

/** The engine result the page must show for this guess. The page seeds from the clock. */
function expectedFor(guess: number) {
  return runBeautyContest(defaultBeautyConfig(NOW.toISOString()), guess);
}

function open(): ComponentFixture<BeautyContestPage> {
  TestBed.configureTestingModule({
    imports: [BeautyContestPage],
    providers: [provideRouter([]), { provide: APP_CLOCK, useValue: () => NOW }],
  });
  const fixture = TestBed.createComponent(BeautyContestPage);
  fixture.detectChanges();
  return fixture;
}

function el(fixture: ComponentFixture<BeautyContestPage>, id: string): HTMLElement | null {
  return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
}

function text(fixture: ComponentFixture<BeautyContestPage>): string {
  return fixture.nativeElement.textContent ?? '';
}

/** Types a guess and submits it. */
function guess(fixture: ComponentFixture<BeautyContestPage>, value: string): void {
  const input = el(fixture, 'beauty-guess') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  (el(fixture, 'beauty-submit') as HTMLButtonElement).click();
  fixture.detectChanges();
}

describe('BeautyContestPage', () => {
  it('has one heading, Beauty contest', () => {
    const fixture = open();

    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Beauty contest');
  });

  it('labels the simulated players as a model, not real people', () => {
    const fixture = open();

    expect(text(fixture)).toContain(MODEL_LABEL);
  });

  it('reveals the mean, the target, a level histogram, and the equilibrium sentence after a guess', () => {
    const fixture = open();
    const expected = expectedFor(50);

    guess(fixture, '50');

    expect(el(fixture, 'beauty-reveal')).not.toBeNull();
    expect(text(fixture)).toContain(expected.mean.toFixed(1));
    expect(text(fixture)).toContain(expected.target.toFixed(1));
    expect(text(fixture)).toContain(EQUILIBRIUM_SENTENCE);
    for (const label of LABELS) {
      const row = el(fixture, `beauty-level-${label}`);
      expect(row, label).not.toBeNull();
      expect(row?.textContent, label).toContain(String(expected.levelCounts[label]));
    }
  });

  it('says whether the player or a simulated player won', () => {
    const fixture = open();
    const expected = expectedFor(50);

    guess(fixture, '50');

    const winner = expected.winnerIndex === -1 ? 'You won' : 'A simulated player won';
    expect(text(fixture)).toContain(winner);
  });

  it('does not reveal for a guess outside 0 to 100', () => {
    const fixture = open();

    guess(fixture, '150');

    expect(el(fixture, 'beauty-reveal')).toBeNull();
  });

  it('keeps the simulated mean in [30, 40] over 500 seeded games', () => {
    let sum = 0;
    let count = 0;
    for (let seed = 0; seed < 500; seed++) {
      const result = runBeautyContest(defaultBeautyConfig(`beauty-mc:${seed}`), 50);
      sum += result.guesses.reduce((a, b) => a + b, 0);
      count += result.guesses.length;
    }

    const mean = sum / count;
    expect(mean).toBeGreaterThanOrEqual(30);
    expect(mean).toBeLessThanOrEqual(40);
  });
});
