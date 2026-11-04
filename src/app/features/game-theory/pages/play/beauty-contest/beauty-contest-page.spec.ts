import { describe, it, expect, vi } from 'vitest';
import { signal, type Signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BeautyContestPage } from './beauty-contest-page';
import { APP_CLOCK } from '../../../../../core/app-clock';
import { GameTheoryData, GameTheoryDataService } from '../../../data/game-theory-data.service';
import { GtEvidenceService } from '../../../state/gt-evidence.service';
import { GtGamesService } from '../../../state/gt-games.service';
import { defaultBeautyConfig, runBeautyContest } from '../../../lib/beauty';
import type { ReasonCheck } from '../../../lib/puzzle.types';

const NOW = new Date('2026-11-03T12:00:00Z');
const LABELS = ['L0', 'L1', 'L2', 'L3', 'L4+'] as const;
const EQUILIBRIUM_SENTENCE = '0 is the equilibrium but not the winning guess';
const MODEL_LABEL = 'Simulated players (a model, not real people)';

// The beauty-simulated-model check from checks.json (context 'beauty', concept level-k-reasoning).
const CHECK: ReasonCheck = {
  id: 'beauty-simulated-model',
  conceptId: 'level-k-reasoning',
  context: 'beauty',
  prompt:
    "The players in the reveal are labelled 'Simulated players (a model, not real people)'. What does the level histogram show?",
  options: [
    {
      id: 'a',
      text: "The level counts follow the mix assumed in the model, so they show the model's assumptions, not measurements of real people.",
      correct: true,
      why: 'The players are generated from assumed level mixes. The histogram follows from those assumptions and is not data about a crowd.',
    },
    {
      id: 'b',
      text: 'The level counts are what a real crowd of people guessed in a survey.',
      correct: false,
      misconceptionId: 'M13',
      why: 'This game has no real crowd. Real figures appear only with a source link, and this histogram is not one of them.',
    },
  ],
};

const DATA: GameTheoryData = {
  concepts: { version: 1, concepts: [], pairs: [] },
  tutorials: { version: 1, tutorials: [] },
  checks: { version: 1, checks: [CHECK] },
};

let evidence: { record: ReturnType<typeof vi.fn> };
let data: { load: ReturnType<typeof vi.fn> };
let failed: WritableSignal<boolean>;
let games: { record: ReturnType<typeof vi.fn>; saveFailed: Signal<boolean> };

/** The engine result the page must show for this guess. The page seeds from the clock. */
function expectedFor(guess: number) {
  return runBeautyContest(defaultBeautyConfig(NOW.toISOString()), guess);
}

/**
 * Opens the page. With checksFail, the checks file fails to load and the reason check is not asked.
 * With saveFailed, the games log write reports a failure, so the page says progress can't be saved.
 */
function open(checksFail = false, saveFailed = false): ComponentFixture<BeautyContestPage> {
  evidence = { record: vi.fn() };
  data = {
    load: vi.fn(() => (checksFail ? throwError(() => new Error('checks down')) : of(DATA))),
  };
  failed = signal(saveFailed);
  games = { record: vi.fn(() => true), saveFailed: failed.asReadonly() };
  TestBed.configureTestingModule({
    imports: [BeautyContestPage],
    providers: [
      provideRouter([]),
      { provide: APP_CLOCK, useValue: () => NOW },
      { provide: GameTheoryDataService, useValue: data },
      { provide: GtEvidenceService, useValue: evidence },
      { provide: GtGamesService, useValue: games },
    ],
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

function click(fixture: ComponentFixture<BeautyContestPage>, id: string): void {
  (el(fixture, id) as HTMLButtonElement).click();
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

  it('asks the beauty reason check only after the reveal', () => {
    const fixture = open();
    expect(el(fixture, 'beauty-reason-check')).toBeNull();

    guess(fixture, '50');

    expect(el(fixture, 'beauty-reason-check')).not.toBeNull();
    expect(text(fixture)).toContain(CHECK.prompt);
  });

  it('records a right reason as a correct challenge on level-k-reasoning, once', () => {
    const fixture = open();
    guess(fixture, '50');

    click(fixture, 'beauty-reason-a');
    click(fixture, 'beauty-reason-b');

    expect(evidence.record).toHaveBeenCalledTimes(1);
    expect(evidence.record).toHaveBeenCalledWith(['level-k-reasoning'], true, 'challenges', NOW);
  });

  it('shows why a wrong reason is wrong, and records it as incorrect', () => {
    const fixture = open();
    guess(fixture, '50');

    click(fixture, 'beauty-reason-b');

    expect(evidence.record).toHaveBeenCalledWith(['level-k-reasoning'], false, 'challenges', NOW);
    expect(text(fixture)).toContain(CHECK.options[1].why);
  });

  it('still shows the reveal, and asks nothing, when the checks fail to load', () => {
    const fixture = open(true);

    guess(fixture, '50');

    expect(el(fixture, 'beauty-reveal')).not.toBeNull();
    expect(el(fixture, 'beauty-reason-check')).toBeNull();
    expect(evidence.record).not.toHaveBeenCalled();
  });

  it('records each completed reveal to the games log as a beauty-contest play (spec §10)', () => {
    const fixture = open();

    guess(fixture, '50');

    const expected = expectedFor(50);
    expect(games.record).toHaveBeenCalledTimes(1);
    expect(games.record).toHaveBeenCalledWith({
      kind: 'beauty-contest',
      at: NOW.toISOString(),
      seed: NOW.toISOString(),
      summary: {
        guess: 50,
        mean: expected.mean,
        target: expected.target,
        humanWon: expected.winnerIndex === -1,
        simulated: defaultBeautyConfig(NOW.toISOString()).simulated,
      },
    });
  });

  it('does not record a guess that is outside 0 to 100', () => {
    const fixture = open();

    guess(fixture, '150');

    expect(games.record).not.toHaveBeenCalled();
  });

  it("says progress can't be saved when the games log write fails", () => {
    const fixture = open(false, true);

    expect(text(fixture)).toContain("Progress can't be saved in this browser");
  });
});
