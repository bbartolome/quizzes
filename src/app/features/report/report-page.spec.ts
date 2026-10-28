import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReportPage } from './report-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import {
  ConfusedPair,
  Concept,
  QuizManifestEntry,
  RoundQuestion,
  ScoredQuestionResult,
} from '../../core/models/quiz.models';

describe('ReportPage', () => {
  const entry: QuizManifestEntry = {
    id: 'rt',
    title: 'Logic Quiz',
    description: 'desc',
    icon: 'icon',
    version: 3,
    dataPath: 'data/rt/',
    order: 1,
    kind: 'traps',
  };

  const strawman: Concept = {
    id: 'strawman',
    name: 'Strawman',
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    spottingTip: 'Strawman misrepresents the argument.',
  };
  const slipperySlope: Concept = {
    id: 'slippery-slope',
    name: 'Slippery Slope',
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    spottingTip: 'tip',
  };
  const kb: Concept[] = [strawman, slipperySlope];
  const pairs: ConfusedPair[] = [
    { concepts: ['strawman', 'slippery-slope'], tip: 'Strawman misrepresents the argument.' },
  ];

  function makeQuestion(overrides: Partial<RoundQuestion> & { id: string }): RoundQuestion {
    return {
      prompt: `Prompt for ${overrides.id}`,
      options: ['Strawman', 'Slippery Slope'],
      correctAnswers: ['Strawman'],
      traitIds: [],
      explanation: `Explanation for ${overrides.id}`,
      ...overrides,
    };
  }

  function makeResult(overrides: Partial<ScoredQuestionResult> = {}): ScoredQuestionResult {
    return {
      question: makeQuestion({ id: 'q1' }),
      selected: [],
      correct: false,
      missed: [],
      extra: [],
      ...overrides,
    };
  }

  let quizData: {
    loadManifest: ReturnType<typeof vi.fn>;
    loadQuizBundle: ReturnType<typeof vi.fn>;
  };

  function setHistoryState(state: unknown): void {
    vi.spyOn(window.history, 'state', 'get').mockReturnValue(state);
  }

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [ReportPage],
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
      ],
    });
  }

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    quizData = {
      loadManifest: vi.fn(() => of({ quizzes: [entry] })),
      loadQuizBundle: vi.fn(() =>
        of({ questions: [], templates: [], knowledgeBase: { concepts: kb, pairs } }),
      ),
    };
  });

  it('shows the no-results empty state linking back to the quiz when there are no results', async () => {
    setHistoryState(undefined);
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const empty = fixture.nativeElement.querySelector('[data-testid="no-results"]');
    expect(empty).toBeTruthy();
    expect(empty.querySelector('a').getAttribute('href')).toBe('/quiz/rt');
    expect(quizData.loadManifest).not.toHaveBeenCalled();
  });

  it('never throws when history.state has no results or quizTitle', async () => {
    setHistoryState({});
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();

    expect(fixture.componentInstance.quizTitle()).toBe('');
    expect(fixture.componentInstance.results()).toEqual([]);
  });

  it('reads results and quizTitle from history.state and loads the knowledge base', async () => {
    const results = [makeResult({ correct: true })];
    setHistoryState({ results, quizTitle: 'Logic Quiz' });
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.quizTitle()).toBe('Logic Quiz');
    expect(fixture.componentInstance.results()).toEqual(results);
    expect(quizData.loadManifest).toHaveBeenCalled();
    expect(quizData.loadQuizBundle).toHaveBeenCalledWith(entry);
    expect(fixture.componentInstance.kb()).toEqual({ concepts: kb, pairs });
  });

  it('renders the summary line produced by summaryLine', async () => {
    const results = [makeResult({ correct: true }), makeResult({ correct: false })];
    setHistoryState({ results, quizTitle: 'Logic Quiz' });
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const summary = fixture.nativeElement.querySelector('[data-testid="summary"]');
    expect(summary.textContent).toContain('1 of 2 correct');
  });

  it('renders a result per entry with its prompt, explanation, and per-option status text', async () => {
    const results = [
      makeResult({
        selected: ['Strawman'],
        correct: true,
        missed: [],
        extra: [],
      }),
    ];
    setHistoryState({ results, quizTitle: 'Logic Quiz' });
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const resultEls = fixture.nativeElement.querySelectorAll('[data-testid="result"]');
    expect(resultEls.length).toBe(1);
    expect(resultEls[0].textContent).toContain('Prompt for q1');
    expect(resultEls[0].querySelector('[data-testid="explanation"]').textContent).toContain(
      'Explanation for q1',
    );

    const optionStatuses = resultEls[0].querySelectorAll('[data-testid="option-status"]');
    expect(optionStatuses.length).toBe(2);
    expect(optionStatuses[0].textContent).toContain('Correct');
    expect(optionStatuses[1].textContent).toContain('Not picked');
  });

  it('labels wrong-pick and missed options correctly', async () => {
    const results = [
      makeResult({
        selected: ['Slippery Slope'],
        correct: false,
        missed: ['Strawman'],
        extra: ['Slippery Slope'],
      }),
    ];
    setHistoryState({ results, quizTitle: 'Logic Quiz' });
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const optionStatuses = fixture.nativeElement.querySelectorAll('[data-testid="option-status"]');
    expect(optionStatuses[0].textContent).toContain('Missed');
    expect(optionStatuses[1].textContent).toContain('Wrong pick');
  });

  it("renders one tip per confusion tip found between a result's options and the loaded kb", async () => {
    const results = [makeResult()];
    setHistoryState({ results, quizTitle: 'Logic Quiz' });
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const tips = fixture.nativeElement.querySelectorAll('[data-testid="tip"]');
    expect(tips.length).toBe(1);
    expect(tips[0].textContent).toContain('Strawman misrepresents the argument.');
  });

  it('renders next-round and back-home links pointing at the current quiz', async () => {
    const results = [makeResult()];
    setHistoryState({ results, quizTitle: 'Logic Quiz' });
    configure();
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const nextRound = fixture.nativeElement.querySelector('[data-testid="next-round"]');
    const backHome = fixture.nativeElement.querySelector('[data-testid="back-home"]');
    expect(nextRound.getAttribute('href')).toBe('/quiz/rt/round');
    expect(backHome.getAttribute('href')).toBe('/quiz/rt');
  });

  describe('design system (S8, §6–§7)', () => {
    async function load(results: ScoredQuestionResult[]) {
      setHistoryState({ results, quizTitle: 'Logic Quiz' });
      configure();
      const fixture = TestBed.createComponent(ReportPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('renders the quiz title as the only h1, inside the page shell', async () => {
      const fixture = await load([makeResult()]);

      expect(fixture.nativeElement.querySelectorAll('h1').length).toBe(1);
      const title = fixture.nativeElement.querySelector('ui-page-shell h1.type-title');
      expect(title?.textContent?.trim()).toBe('Logic Quiz');
    });

    it('renders each result as a raised Card with an h3 type-card heading', async () => {
      const fixture = await load([makeResult()]);

      const result = fixture.nativeElement.querySelector('[data-testid="result"]');
      expect(result.hasAttribute('uiCard')).toBe(true);
      const heading = result.querySelector('h3');
      expect(heading?.textContent).toContain('Prompt for q1');
      expect(heading.classList).toContain('type-card');
    });

    it('gives a correct option the success tone and an unpicked one the neutral tone', async () => {
      const fixture = await load([makeResult({ selected: ['Strawman'], correct: true })]);

      const statuses = fixture.nativeElement.querySelectorAll('[data-testid="option-status"]');
      expect(statuses[0].querySelector('ui-status > span').classList).toContain('text-success');
      expect(statuses[1].querySelector('ui-status > span').classList).toContain('text-muted');
    });

    it('gives a missed option the warning tone and a wrong pick the danger tone', async () => {
      const fixture = await load([
        makeResult({
          selected: ['Slippery Slope'],
          correct: false,
          missed: ['Strawman'],
          extra: ['Slippery Slope'],
        }),
      ]);

      const statuses = fixture.nativeElement.querySelectorAll('[data-testid="option-status"]');
      expect(statuses[0].querySelector('ui-status > span').classList).toContain('text-warning');
      expect(statuses[1].querySelector('ui-status > span').classList).toContain('text-danger');
    });

    it('keeps each option row neutral, so only its status carries the tone', async () => {
      const fixture = await load([makeResult({ selected: ['Strawman'], correct: true })]);

      const status = fixture.nativeElement.querySelector('[data-testid="option-status"]');
      expect(status.classList).toContain('border-default');
      expect(status.classList).toContain('bg-sunken');
      expect(status.classList).not.toContain('border-slate-100');
    });

    it('renders each confusion tip as a Callout labelled with the pair', async () => {
      const fixture = await load([makeResult()]);

      const tip = fixture.nativeElement.querySelector('[data-testid="tip"]');
      expect(tip.tagName.toLowerCase()).toBe('ui-callout');
      expect(tip.textContent).toContain('Strawman vs Slippery Slope:');
    });

    it('renders the no-results block as an EmptyState with a primary Go to quiz button', async () => {
      const fixture = await load([]);

      const empty = fixture.nativeElement.querySelector('[data-testid="no-results"]');
      expect(empty.tagName.toLowerCase()).toBe('ui-empty-state');
      expect(empty.querySelector('h2').classList).toContain('type-section');
      expect(empty.querySelector('a').classList).toContain('bg-accent');
    });

    it('makes Back to quiz a secondary button and Next round the primary one', async () => {
      const fixture = await load([makeResult()]);

      const backHome = fixture.nativeElement.querySelector('[data-testid="back-home"]');
      const nextRound = fixture.nativeElement.querySelector('[data-testid="next-round"]');
      expect(backHome.classList).toContain('border-strong');
      expect(nextRound.classList).toContain('bg-accent');
    });
  });
});
