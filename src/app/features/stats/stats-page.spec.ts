import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { StatsPage } from './stats-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { KnowledgeBaseEntry, QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
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

  const strawman: KnowledgeBaseEntry = {
    id: 'strawman',
    name: 'Strawman',
    type: 'fallacy',
    shortDefinition: 'Misrepresents an argument.',
    longExplanation: 'Long explanation.',
    example: 'Example.',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
  };
  const slipperySlope: KnowledgeBaseEntry = {
    id: 'slippery-slope',
    name: 'Slippery Slope',
    type: 'fallacy',
    shortDefinition: 'Chains unlikely consequences.',
    longExplanation: 'Long explanation.',
    example: 'Example.',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
  };
  const kb: KnowledgeBaseEntry[] = [strawman, slipperySlope];

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
      loadQuizBundle: vi.fn(() => of({ questions: [], templates: [], knowledgeBase: kb })),
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

  it('renders one trait-row per computed row, each with a width-styled bar', async () => {
    configure();
    const fixture = TestBed.createComponent(StatsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const expectedRows = traitRows(populatedStats, kb);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="trait-row"]');
    expect(rows.length).toBe(expectedRows.length);

    const bar = rows[0].querySelector('div');
    expect(bar.style.width).toBe(`${expectedRows[0].accuracy}%`);
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
