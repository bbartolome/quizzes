import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { StatsPage } from './stats-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { Concept, QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
import { overallAccuracy, traitRows } from './stats-rows';

describe('StatsPage', () => {
  const entry: QuizManifestEntry = {
    id: 'rt',
    title: 'Logic Quiz',
    description: 'desc',
    icon: 'icon',
    accent: 'accent',
    version: 3,
    dataPath: 'data/rt/',
    order: 1,
    kind: 'traps',
  };

  const strawman: Concept = {
    id: 'strawman',
    name: 'Strawman',
    type: 'fallacy',
    shortDefinition: 'Misrepresents an argument.',
    longExplanation: 'Long explanation.',
    example: 'Example.',
    spottingTip: 'tip',
  };
  const slipperySlope: Concept = {
    id: 'slippery-slope',
    name: 'Slippery Slope',
    type: 'fallacy',
    shortDefinition: 'Chains unlikely consequences.',
    longExplanation: 'Long explanation.',
    example: 'Example.',
    spottingTip: 'tip',
  };
  const kb: Concept[] = [strawman, slipperySlope];

  const populatedStats: QuizStats = {
    quizId: 'rt',
    version: 3,
    perTrait: {
      strawman: { traitId: 'strawman', correct: 3, attempted: 4 },
      'slippery-slope': { traitId: 'slippery-slope', correct: 1, attempted: 5 },
    },
    streak: 2,
    roundsPlayed: 6,
  };

  const emptyStats: QuizStats = {
    quizId: 'rt',
    version: 3,
    perTrait: {},
    streak: 0,
    roundsPlayed: 0,
  };

  let quizData: {
    loadManifest: ReturnType<typeof vi.fn>;
    loadQuizBundle: ReturnType<typeof vi.fn>;
  };
  let statsService: { getStats: ReturnType<typeof vi.fn>; resetQuiz: ReturnType<typeof vi.fn> };

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [StatsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'rt' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: QuizDataService, useValue: quizData },
        { provide: StatsService, useValue: statsService },
      ],
    });
  }

  beforeEach(() => {
    quizData = {
      loadManifest: vi.fn(() => of({ quizzes: [entry] })),
      loadQuizBundle: vi.fn(() =>
        of({ questions: [], templates: [], knowledgeBase: { concepts: kb, pairs: [] } }),
      ),
    };
    statsService = {
      getStats: vi.fn(() => populatedStats),
      resetQuiz: vi.fn(),
    };
  });

  it('renders rounds-played, streak, and overall-accuracy from the loaded stats', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect(el.querySelector('[data-testid="rounds-played"]').textContent).toContain('6');
    expect(el.querySelector('[data-testid="streak"]').textContent).toContain('2');
    expect(el.querySelector('[data-testid="overall-accuracy"]').textContent).toContain(
      `${overallAccuracy(populatedStats)}%`,
    );
  });

  it('renders one trait-row per computed row, each with a ProgressBar sized to its accuracy', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const expectedRows = traitRows(populatedStats, kb);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="trait-row"]');
    expect(rows.length).toBe(expectedRows.length);

    const bar = rows[0].querySelector('ui-progress > div > div');
    expect(bar.style.width).toBe(`${expectedRows[0].accuracy}%`);
  });

  it('renders the page in the narrow shell with a back link to the quiz', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    expect(el.querySelector('ui-page-shell .max-w-2xl')).toBeTruthy();
    const back = el.querySelector('[data-testid="back-home"]');
    expect(back.textContent.trim()).toBe('← Back to Logic Quiz');
    expect(back.getAttribute('href')).toBe('/quiz/rt');
  });

  it('shows the rounds, streak and accuracy as stat tiles on the type scale', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement;
    const roundsPlayed = el.querySelector('[data-testid="rounds-played"]');
    expect(roundsPlayed.classList).toContain('type-stat');
    const tile = roundsPlayed.closest('[uiCard]');
    expect(tile.querySelector('.type-eyebrow').textContent.trim()).toBe('Rounds played');
    expect(el.querySelector('[data-testid="streak"]').classList).toContain('type-stat');
    expect(el.querySelector('[data-testid="overall-accuracy"]').classList).toContain('type-stat');
  });

  it('sets the performance heading to the section type role', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const heading = fixture.nativeElement.querySelector('#performance-heading');
    expect(heading.classList).toContain('type-section');
  });

  it('makes the focus-round link the primary button', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const focusRound = fixture.nativeElement.querySelector('[data-testid="focus-round"]');
    expect(focusRound.hasAttribute('uiButton')).toBe(true);
    expect(focusRound.classList).toContain('bg-accent');
  });

  it('makes reset progress a danger button', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const reset = fixture.nativeElement.querySelector('[data-testid="reset-quiz"]');
    expect(reset.hasAttribute('uiButton')).toBe(true);
    expect(reset.classList).toContain('bg-danger');
    expect(reset.classList).not.toContain('bg-white');
  });

  it('shows the no-stats state as an EmptyState with a section-scale heading', async () => {
    statsService.getStats = vi.fn(() => emptyStats);
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const empty = fixture.nativeElement.querySelector('[data-testid="no-stats"]');
    expect(empty.tagName.toLowerCase()).toBe('ui-empty-state');
    expect(empty.querySelector('h2').classList).toContain('type-section');
    expect(empty.textContent).toContain('No stats yet');
  });

  it('shows the focus-round link to the traits-filtered round when rows are non-empty', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const focusRound = fixture.nativeElement.querySelector('[data-testid="focus-round"]');
    expect(focusRound).toBeTruthy();
    expect(focusRound.getAttribute('href')).toBe('/quiz/rt/round?weakTraits=true');
  });

  it('does not show the focus-round link when there are no rows', async () => {
    statsService.getStats = vi.fn(() => emptyStats);
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="focus-round"]')).toBeFalsy();
  });

  it('keeps the "Performance by trait" heading', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#performance-heading').textContent.trim()).toBe(
      'Performance by trait',
    );
  });

  it('shows the no-stats indicator when roundsPlayed is 0', async () => {
    statsService.getStats = vi.fn(() => emptyStats);
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="no-stats"]')).toBeTruthy();
  });

  it('does not show the no-stats indicator when roundsPlayed is greater than 0', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="no-stats"]')).toBeFalsy();
  });

  it('resets progress and reloads stats when the reset button is clicked and confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    statsService.getStats.mockClear();
    fixture.nativeElement.querySelector('[data-testid="reset-quiz"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(window.confirm).toHaveBeenCalledWith(
      'Reset all progress for this quiz? This cannot be undone.',
    );
    expect(statsService.resetQuiz).toHaveBeenCalledWith('rt');
    expect(statsService.getStats).toHaveBeenCalledWith('rt');
  });

  it('does not reset progress when the reset confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="reset-quiz"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(statsService.resetQuiz).not.toHaveBeenCalled();
  });
});

describe('StatsPage flash card routes', () => {
  const entry: QuizManifestEntry = {
    id: 'biases',
    title: 'Cognitive biases',
    description: 'desc',
    icon: 'icon',
    accent: 'accent',
    version: 1,
    order: 1,
    kind: 'biases',
  };
  const anchoring: Concept = {
    id: 'anchoring',
    name: 'Anchoring',
    type: 'bias',
    shortDefinition: 'Over-relies on the first number.',
    longExplanation: 'Long explanation.',
    example: 'Example.',
    spottingTip: 'tip',
  };
  const stats: QuizStats = {
    quizId: 'biases',
    version: 1,
    perTrait: { anchoring: { traitId: 'anchoring', correct: 1, attempted: 4 } },
    streak: 1,
    roundsPlayed: 2,
  };

  let quizData: {
    loadManifest: ReturnType<typeof vi.fn>;
    loadQuizBundle: ReturnType<typeof vi.fn>;
    loadKnowledgeBase: ReturnType<typeof vi.fn>;
  };
  let statsService: { getStats: ReturnType<typeof vi.fn>; resetQuiz: ReturnType<typeof vi.fn> };

  async function render() {
    TestBed.configureTestingModule({
      imports: [StatsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'biases' }),
              queryParamMap: convertToParamMap({}),
              data: { conceptType: 'bias' },
            },
          },
        },
        { provide: QuizDataService, useValue: quizData },
        { provide: StatsService, useValue: statsService },
      ],
    });
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    quizData = {
      loadManifest: vi.fn(() => of({ quizzes: [entry] })),
      loadQuizBundle: vi.fn(),
      loadKnowledgeBase: vi.fn(() => of({ concepts: [anchoring], pairs: [] })),
    };
    statsService = { getStats: vi.fn(() => stats), resetQuiz: vi.fn() };
  });

  it('loads concept names from loadKnowledgeBase() and never loadQuizBundle', async () => {
    const fixture = await render();

    expect(quizData.loadKnowledgeBase).toHaveBeenCalledWith();
    expect(quizData.loadQuizBundle).not.toHaveBeenCalled();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="trait-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Anchoring');
  });

  it('headlines the rows "Performance by concept"', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.querySelector('#performance-heading').textContent.trim()).toBe(
      'Performance by concept',
    );
  });

  it('hides the focus-round link even when rows exist', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="trait-row"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="focus-round"]')).toBeFalsy();
  });

  it('reads stats for the route id', async () => {
    await render();

    expect(statsService.getStats).toHaveBeenCalledWith('biases');
  });

  it('links the back link to the flash card home', async () => {
    const fixture = await render();

    const back = fixture.nativeElement.querySelector('[data-testid="back-home"]');
    expect(back.textContent.trim()).toBe('← Back to Cognitive biases');
    expect(back.getAttribute('href')).toBe('/biases/biases');
  });

  it('resets only the route id and re-reads its stats', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = await render();

    statsService.getStats.mockClear();
    fixture.nativeElement.querySelector('[data-testid="reset-quiz"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(statsService.resetQuiz).toHaveBeenCalledTimes(1);
    expect(statsService.resetQuiz).toHaveBeenCalledWith('biases');
    expect(statsService.getStats).toHaveBeenCalledWith('biases');
  });
});
