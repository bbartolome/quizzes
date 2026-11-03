import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { CardsPage } from './cards-page';
import { GameTheoryData, GameTheoryDataService } from '../../data/game-theory-data.service';
import { mulberry32 } from '../../lib/rng';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';
import { APP_CLOCK } from '../../../../core/app-clock';
import { StatsService } from '../../../../core/services/stats.service';
import type { GameTheoryConcept, QuizStats } from '../../../../core/models/quiz.models';
import { FakeGtEvidenceService } from '../../../../../testing/fake-gt-evidence.service';
import { FakeGtLearnService } from '../../../../../testing/fake-gt-learn.service';

const SEED = 20260101;
const NOW = new Date('2026-11-03T12:00:00Z');
const TARGET = 'chicken-game';

function concept(id: string, name: string, modes: GameTheoryConcept['modes']): GameTheoryConcept {
  return {
    id,
    name,
    type: 'game-theory',
    shortDefinition: `${name}, in one line.`,
    longExplanation: `${name}, explained.`,
    example: `An example of ${name}.`,
    spottingTip: `Spot ${name} by its payoffs.`,
    tier: 1,
    prerequisites: [],
    modes,
  };
}

// Six concepts: four with a challenge mode, and backward-induction, which is cards-only.
const CONCEPTS: GameTheoryConcept[] = [
  concept('chicken-game', 'Chicken game', ['cards', 'classify']),
  concept('stag-hunt', 'Stag hunt', ['cards', 'classify']),
  concept('prisoners-dilemma', 'Prisoners dilemma', ['cards', 'classify', 'bots']),
  concept('best-response', 'Best response', ['cards', 'equilibrium']),
  concept('nash-equilibrium', 'Nash equilibrium', ['cards', 'equilibrium']),
  concept('backward-induction', 'Backward induction', ['cards']),
];
const IDS = CONCEPTS.map((c) => c.id);

const DATA: GameTheoryData = {
  concepts: {
    version: 1,
    concepts: CONCEPTS,
    pairs: [
      { concepts: ['chicken-game', 'stag-hunt'], tip: 'Chicken: mutual defection is worst.' },
    ],
  },
  tutorials: { version: 1, tutorials: [] },
  checks: { version: 1, checks: [] },
};

const NO_STATS: QuizStats = {
  quizId: 'game-theory:cards',
  version: 1,
  perTrait: {},
  streak: 0,
  roundsPlayed: 0,
};

let evidence: FakeGtEvidenceService;
let learn: FakeGtLearnService;
let data: { load: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> };

/** Opens the page with the given concepts introduced. With contentFails, the first load errors. */
function open(
  options: { introduced?: string[]; contentFails?: boolean } = {},
): ComponentFixture<CardsPage> {
  evidence = new FakeGtEvidenceService();
  learn = new FakeGtLearnService();
  learn.seedIntroduced(options.introduced ?? []);
  data = {
    load: vi.fn(() =>
      options.contentFails ? throwError(() => new Error('content down')) : of(DATA),
    ),
    retry: vi.fn((): Observable<GameTheoryData> => of(DATA)),
  };
  TestBed.configureTestingModule({
    imports: [CardsPage],
    providers: [
      provideRouter([]),
      { provide: GAME_THEORY_RNG, useValue: mulberry32(SEED) },
      { provide: APP_CLOCK, useValue: () => NOW },
      { provide: StatsService, useValue: { getStats: () => NO_STATS } },
      { provide: GameTheoryDataService, useValue: data },
      { provide: GtEvidenceService, useValue: evidence },
      { provide: GtLearnService, useValue: learn },
    ],
  });
  const fixture = TestBed.createComponent(CardsPage);
  fixture.detectChanges();
  return fixture;
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) {
    throw new Error(`no element matches ${selector}`);
  }
  return found;
}

function tap(fixture: ComponentFixture<CardsPage>, selector: string): void {
  must<HTMLElement>(fixture.nativeElement, selector).click();
  fixture.detectChanges();
}

/** The concept id behind each option button, in the order shown. */
function optionConcepts(root: HTMLElement): string[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('[data-testid^="cards-option-"]'),
    (button) => button.dataset['concept'] ?? '',
  );
}

/** Picks the option that is the target, then checks the answer. */
function answerRight(fixture: ComponentFixture<CardsPage>, target: string): void {
  tap(fixture, `[data-testid^="cards-option-"][data-concept="${target}"]`);
  tap(fixture, '[data-testid="cards-check"]');
}

/** Picks the first option that is not the target, then checks the answer. */
function answerWrong(fixture: ComponentFixture<CardsPage>, target: string): void {
  const wrong = optionConcepts(fixture.nativeElement).find((id) => id !== target);
  if (!wrong) {
    throw new Error('no wrong option to pick');
  }
  tap(fixture, `[data-testid^="cards-option-"][data-concept="${wrong}"]`);
  tap(fixture, '[data-testid="cards-check"]');
}

describe('CardsPage (cards, §7.2, §9.1)', () => {
  it('with nothing introduced, shows the empty state with Start with Best response and a Test out link, and no card', () => {
    const fixture = open();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Start with Best response');
    const link = must<HTMLAnchorElement>(root, '[data-testid="cards-test-out-link"]');
    expect(link.textContent?.trim()).toBe('Test out');
    expect(link.getAttribute('href')).toBe('/game-theory/test-out/best-response');
    expect(root.querySelector('[data-testid^="cards-option-"]')).toBeNull();
    expect(root.querySelector('[data-testid="cards-check"]')).toBeNull();
  });

  it('draws the target from the introduced concepts, and the choices include it with lures from the whole deck', () => {
    const fixture = open({ introduced: [TARGET] });
    const choices = optionConcepts(fixture.nativeElement);

    expect(choices).toHaveLength(4);
    expect(new Set(choices).size).toBe(4);
    expect(choices).toContain(TARGET);
    expect(choices.every((id) => IDS.includes(id))).toBe(true);
  });

  it('draws each target from the introduced concepts only, never repeating the last one', () => {
    const introduced = ['best-response', 'nash-equilibrium'];
    const fixture = open({ introduced });
    const targets: string[] = [];

    for (let i = 0; i < 5; i += 1) {
      tap(fixture, '[data-testid^="cards-option-"]');
      tap(fixture, '[data-testid="cards-check"]');
      targets.push(evidence.records[i].conceptIds[0]);
      tap(fixture, '[data-testid="cards-next"]');
    }

    expect(targets.every((id) => introduced.includes(id))).toBe(true);
    expect(targets.slice(1).every((id, i) => id !== targets[i])).toBe(true);
  });

  it('records a correct answer once under cards with the target id, and shows the verdict, the name and the tip', () => {
    const fixture = open({ introduced: [TARGET] });
    const root: HTMLElement = fixture.nativeElement;

    answerRight(fixture, TARGET);

    expect(evidence.records).toEqual([{ conceptIds: [TARGET], correct: true, facet: 'cards' }]);
    const feedback = must<HTMLElement>(root, '[data-testid="cards-feedback"]');
    expect(feedback.textContent).toContain('Correct');
    expect(feedback.textContent).toContain('Chicken game');
    expect(feedback.textContent).toContain('Spot Chicken game by its payoffs.');
  });

  it('records a wrong answer under cards with the target id, and names the target in the feedback', () => {
    const fixture = open({ introduced: [TARGET] });
    const root: HTMLElement = fixture.nativeElement;

    answerWrong(fixture, TARGET);

    expect(evidence.records).toEqual([{ conceptIds: [TARGET], correct: false, facet: 'cards' }]);
    const feedback = must<HTMLElement>(root, '[data-testid="cards-feedback"]');
    expect(feedback.textContent).toContain('Incorrect');
    expect(feedback.textContent).toContain('Chicken game');
  });

  it('End calls recordSessionEnd once, and the summary shows the answered and correct counts with a link to the hub', () => {
    const fixture = open({ introduced: [TARGET] });
    const root: HTMLElement = fixture.nativeElement;

    answerRight(fixture, TARGET);
    tap(fixture, '[data-testid="cards-next"]');
    answerWrong(fixture, TARGET);
    tap(fixture, '[data-testid="cards-end"]');

    expect(evidence.sessionEnds).toBe(1);
    expect(must<HTMLElement>(root, '[data-testid="cards-summary"]').textContent).toContain(
      '2 answered, 1 correct',
    );
    expect(root.querySelector('[data-testid^="cards-option-"]')).toBeNull();
    expect(
      must<HTMLAnchorElement>(root, '[data-testid="cards-hub-link"]').getAttribute('href'),
    ).toBe('/game-theory');
  });

  it("shows Couldn't load the cards with a Retry that calls retry, and then shows the cards", () => {
    const fixture = open({ introduced: [TARGET], contentFails: true });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain("Couldn't load the cards");
    expect(root.querySelector('[data-testid^="cards-option-"]')).toBeNull();

    tap(fixture, '[data-testid="cards-retry"]');

    expect(data.retry).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-testid="cards-option-0"]')).not.toBeNull();
  });

  it('migrates the content and refreshes the learn summary with the requiresChallenge map once the content loads', () => {
    open({ introduced: [TARGET] });

    expect(evidence.migrations).toEqual([{ version: 1, conceptIds: IDS }]);
    expect(learn.refreshCalls).toEqual([
      {
        conceptIds: IDS,
        requiresChallenge: {
          'chicken-game': true,
          'stag-hunt': true,
          'prisoners-dilemma': true,
          'best-response': true,
          'nash-equilibrium': true,
          'backward-induction': false,
        },
      },
    ]);
  });

  it('renders one h1 inside a ui-page-shell, with a back link to the hub', () => {
    const fixture = open({ introduced: [TARGET] });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('ui-page-shell')).not.toBeNull();
    const headings = root.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('Cards');
    expect(must<HTMLAnchorElement>(root, '[data-testid="back-hub"]').getAttribute('href')).toBe(
      '/game-theory',
    );
  });

  it("shows Progress can't be saved in this browser when a write fails", () => {
    const fixture = open({ introduced: [TARGET] });
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).not.toContain("Progress can't be saved in this browser");

    evidence.setSaveFailed(true);
    fixture.detectChanges();

    expect(root.textContent).toContain("Progress can't be saved in this browser");
  });
});
