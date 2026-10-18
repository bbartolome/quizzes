import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReportPage } from './report-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import {
  KnowledgeBaseEntry,
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
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    commonlyConfusedWith: ['slippery-slope'],
    distinguishingTip: 'Strawman misrepresents the argument.',
  };
  const slipperySlope: KnowledgeBaseEntry = {
    id: 'slippery-slope',
    name: 'Slippery Slope',
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
  };
  const kb: KnowledgeBaseEntry[] = [strawman, slipperySlope];

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

  let quizData: { loadManifest: ReturnType<typeof vi.fn>; loadQuizBundle: ReturnType<typeof vi.fn> };

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
      loadQuizBundle: vi.fn(() => of({ questions: [], templates: [], knowledgeBase: kb })),
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
    expect(fixture.componentInstance.kb()).toEqual(kb);
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

  it('renders one tip per confusion tip found between a result\'s options and the loaded kb', async () => {
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
});
