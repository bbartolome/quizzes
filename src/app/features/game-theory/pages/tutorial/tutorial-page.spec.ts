import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { TutorialPage } from './tutorial-page';
import { GameTheoryData, GameTheoryDataService } from '../../data/game-theory-data.service';
import { GtLearnService } from '../../state/gt-learn.service';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import { mulberry32 } from '../../lib/rng';
import type { GameTheoryContent } from '../../../../core/models/quiz.models';
import { FakeGtEvidenceService } from '../../../../../testing/fake-gt-evidence.service';
import { FakeGtLearnService } from '../../../../../testing/fake-gt-learn.service';
import conceptsJson from '../../../../../../public/data/quizzes/game-theory/concepts.json';
import tutorialsJson from '../../../../../../public/data/quizzes/game-theory/tutorials.json';
import checksJson from '../../../../../../public/data/quizzes/game-theory/checks.json';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

// The tutorial page runs the shipped scripts (spec §7.1). These specs use the real content, so
// they also exercise the authored text and games.

const DATA = {
  concepts: conceptsJson as unknown as GameTheoryContent,
  tutorials: tutorialsJson,
  checks: checksJson,
} as unknown as GameTheoryData;

describe('TutorialPage', () => {
  let learn: FakeGtLearnService;
  let evidence: FakeGtEvidenceService;
  let data: { load: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> };

  /** Opens the tutorial for one concept. A failed first load is shown when contentFails is set. */
  function open(
    id: string,
    options: { introduced?: string[]; stage?: 0 | 1 | 2 | 3; contentFails?: boolean } = {},
  ): ComponentFixture<TutorialPage> {
    learn = new FakeGtLearnService();
    learn.seedIntroduced(options.introduced ?? []);
    evidence = new FakeGtEvidenceService();
    data = {
      load: vi.fn((): Observable<GameTheoryData> =>
        options.contentFails ? throwError(() => new Error('content down')) : of(DATA),
      ),
      retry: vi.fn((): Observable<GameTheoryData> => of(DATA)),
    };
    TestBed.configureTestingModule({
      imports: [TutorialPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ concept: id })) } },
        { provide: GameTheoryDataService, useValue: data },
        { provide: GtLearnService, useValue: learn },
        { provide: GtEvidenceService, useValue: evidence },
        { provide: GAME_THEORY_RNG, useValue: mulberry32(7) },
      ],
    });
    const fixture = TestBed.createComponent(TutorialPage);
    fixture.detectChanges();
    return fixture;
  }

  const text = (root: HTMLElement) => root.textContent ?? '';
  const next = (root: HTMLElement) => {
    (root.querySelector('[data-testid="tutorial-next"]') as HTMLButtonElement).click();
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens at the Explore of a concept that has not been started', () => {
    const root = open('best-response').nativeElement as HTMLElement;

    expect(text(root)).toContain('A best response is the move that does best');
    expect(learn.read().concepts['best-response']).toBeUndefined();
  });

  it('records Explore as stage 1 and the Try as stage 2 once the lesson reaches it', () => {
    const fixture = open('best-response');
    const root = fixture.nativeElement as HTMLElement;

    next(root); // text done
    fixture.detectChanges();
    next(root); // reveal annotation 2
    fixture.detectChanges();
    next(root); // worked done, the Try starts
    fixture.detectChanges();

    expect(learn.read().concepts['best-response']?.stage).toBe(2);
    expect(text(root)).toContain('Underline');
  });

  it('shows one worked annotation at a time, each on a Next press', () => {
    const fixture = open('best-response');
    const root = fixture.nativeElement as HTMLElement;
    next(root);
    fixture.detectChanges();

    expect(root.querySelectorAll('[data-testid="tutorial-annotation"]')).toHaveLength(1);
    next(root);
    fixture.detectChanges();
    expect(root.querySelectorAll('[data-testid="tutorial-annotation"]')).toHaveLength(2);
  });

  it('reveals the next hint after a wrong answer, and does not record the Try as evidence', () => {
    const fixture = open('nash-equilibrium');
    const root = fixture.nativeElement as HTMLElement;
    next(root);
    fixture.detectChanges();
    next(root);
    fixture.detectChanges();
    next(root);
    fixture.detectChanges();
    // A wrong pick: Top and Right is not stable. Pick it, then check.
    (root.querySelector('button[aria-label^="Row Top, column Right"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (root.querySelector('[data-testid="tutorial-check"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="tutorial-feedback"]')?.textContent).toContain('Not quite');
    expect(root.querySelector('[data-testid="tutorial-hint"]')?.textContent).toContain(
      'A cell is an equilibrium',
    );
    expect(evidence.records).toEqual([]);
  });

  it('asks a Pareto try-it for the efficient cells, with no None button, since one cell is always efficient', () => {
    const fixture = open('pareto-efficiency');
    const root = fixture.nativeElement as HTMLElement;
    for (let i = 0; i < 10 && !root.querySelector('[data-testid="tutorial-task"]'); i++) {
      next(root);
      fixture.detectChanges();
    }

    expect(text(root)).toContain('Select each cell that is Pareto efficient');
    expect(root.querySelector('[data-testid="payoff-none"]')).toBeNull();
  });

  it('uses the default card script for a concept with no hand-written tutorial', () => {
    const fixture = open('repeated-game');
    const root = fixture.nativeElement as HTMLElement;
    next(root);
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="tutorial-card"]')).not.toBeNull();
  });

  it('opens at the Solo of a concept already at Try, with a link to its solo set', () => {
    const fixture = open('best-response', { introduced: ['best-response'] });
    const root = fixture.nativeElement as HTMLElement;

    const link = root.querySelector('[data-testid="tutorial-solo-link"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toContain('/game-theory/puzzles/equilibrium');
    expect(link.getAttribute('href')).toContain('solo=best-response');
    expect(link.getAttribute('href')).toContain('mode=tutorial');
  });

  it('says so for an id with no tutorial', () => {
    const root = open('no-such-concept').nativeElement as HTMLElement;

    expect(text(root)).toContain("No tutorial for this idea yet");
  });

  it('shows a retry state when the content fails, and loads it again on Retry', () => {
    const fixture = open('best-response', { contentFails: true });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="tutorial-failed"]')).not.toBeNull();

    (root.querySelector('[data-testid="tutorial-retry"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(data.retry).toHaveBeenCalledTimes(1);
    expect(text(root)).toContain('A best response is the move that does best');
  });
});
