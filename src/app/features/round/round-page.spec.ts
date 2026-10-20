import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RoundPage } from './round-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { QuizEngineService } from '../../core/services/quiz-engine.service';
import { TemplateGeneratorService } from '../../core/services/template-generator.service';
import {
  KnowledgeBaseEntry,
  QuizManifestEntry,
  RoundQuestion,
  ScoredQuestionResult,
} from '../../core/models/quiz.models';

describe('RoundPage', () => {
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

  const kb: KnowledgeBaseEntry[] = [
    {
      id: 'kb1',
      name: 'Straw Man',
      type: 'fallacy',
      shortDefinition: 'short',
      longExplanation: 'long',
      example: 'example',
      commonlyConfusedWith: [],
      distinguishingTip: 'tip',
    },
  ];

  const q1: RoundQuestion = {
    id: 'q1',
    prompt: 'P1',
    options: ['A', 'B'],
    correctAnswers: ['A'],
    traitIds: [],
    explanation: 'E1',
  };
  const q2: RoundQuestion = {
    id: 'q2',
    prompt: 'P2',
    options: ['A', 'B'],
    correctAnswers: ['B'],
    traitIds: [],
    explanation: 'E2',
  };

  let quizData: {
    loadManifest: ReturnType<typeof vi.fn>;
    loadQuizBundle: ReturnType<typeof vi.fn>;
  };
  let stats: {
    migrateVersion: ReturnType<typeof vi.fn>;
    getWeakTraits: ReturnType<typeof vi.fn>;
    recordResult: ReturnType<typeof vi.fn>;
    recordSessionEnd: ReturnType<typeof vi.fn>;
  };
  let engine: { selectRound: ReturnType<typeof vi.fn>; score: ReturnType<typeof vi.fn> };
  let templateGenerator: { render: ReturnType<typeof vi.fn> };

  function configure(): void {
    quizData.loadQuizBundle = vi.fn(() => of({ questions: [], templates: [], knowledgeBase: kb }));

    TestBed.configureTestingModule({
      imports: [RoundPage],
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
        { provide: StatsService, useValue: stats },
        { provide: QuizEngineService, useValue: engine },
        { provide: TemplateGeneratorService, useValue: templateGenerator },
      ],
    });
  }

  function scoreStub(question: RoundQuestion, selected: string[]): ScoredQuestionResult {
    const correctSet = new Set(question.correctAnswers);
    const selectedSet = new Set(selected);
    const missed = question.correctAnswers.filter((a) => !selectedSet.has(a));
    const extra = selected.filter((s) => !correctSet.has(s));
    const correct = question.correctAnswers.length === selected.length && missed.length === 0;
    return { question, selected, correct, missed, extra };
  }

  beforeEach(() => {
    quizData = {
      loadManifest: vi.fn(() => of({ quizzes: [entry] })),
      loadQuizBundle: vi.fn(() => of({ questions: [], templates: [], knowledgeBase: kb })),
    };
    stats = {
      migrateVersion: vi.fn(),
      getWeakTraits: vi.fn(() => []),
      recordResult: vi.fn(),
      recordSessionEnd: vi.fn(),
    };
    engine = {
      selectRound: vi
        .fn()
        .mockReturnValueOnce([q1])
        .mockReturnValueOnce([q2])
        .mockReturnValueOnce([]),
      score: vi.fn(scoreStub),
    };
    templateGenerator = { render: vi.fn() };
  });

  it('renders one question after load', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const questionEls = fixture.nativeElement.querySelectorAll('[data-testid="question"]');
    expect(questionEls.length).toBe(1);
  });

  it('disables check-answer until an option is ticked', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const checkBtn = fixture.nativeElement.querySelector('[data-testid="check-answer"]');
    expect(checkBtn.disabled).toBe(true);

    fixture.componentInstance.toggle(0, 'A');
    fixture.detectChanges();

    expect(checkBtn.disabled).toBe(false);
  });

  it('checking the correct option records a correct result and reveals feedback and the next question', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.toggle(0, 'A');
    fixture.componentInstance.check();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(stats.recordResult).toHaveBeenCalledTimes(1);
    expect(stats.recordResult).toHaveBeenCalledWith(
      'rt',
      expect.objectContaining({ correct: true }),
    );

    const feedback = fixture.nativeElement.querySelector('[data-testid="feedback"]');
    expect(feedback).toBeTruthy();
    expect(feedback.textContent).toContain('E1');

    const questionEls = fixture.nativeElement.querySelectorAll('[data-testid="question"]');
    expect(questionEls.length).toBe(2);

    const firstOptions = questionEls[0].querySelectorAll('[data-testid="option"]');
    for (const option of Array.from(firstOptions) as HTMLInputElement[]) {
      expect(option.disabled).toBe(true);
    }
  });

  it('shows "1 / 1 correct" in the score footer after checking the correct option', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.toggle(0, 'A');
    fixture.componentInstance.check();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const score = fixture.nativeElement.querySelector('[data-testid="score"]');
    expect(score.textContent).toContain('1 / 1 correct');
  });

  it('shows the exhausted message and adds no further question once selectRound returns none', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.toggle(0, 'A');
    fixture.componentInstance.check();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.toggle(1, 'B');
    fixture.componentInstance.check();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.exhausted()).toBe(true);
    expect(fixture.componentInstance.entries().length).toBe(2);

    const exhaustedEl = fixture.nativeElement.querySelector('[data-testid="exhausted"]');
    expect(exhaustedEl).toBeTruthy();
  });

  it('endQuiz navigates with the checked results and records the session end', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.toggle(0, 'A');
    fixture.componentInstance.check();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const checkedResult = fixture.componentInstance.entries()[0].result;

    fixture.componentInstance.endQuiz();

    expect(stats.recordSessionEnd).toHaveBeenCalledWith('rt');
    expect(navigateSpy).toHaveBeenCalledWith(['/quiz', 'rt', 'report'], {
      state: { results: [checkedResult], quizTitle: 'Logic Quiz' },
    });
  });

  it('endQuiz with nothing checked does not record a session end and navigates with no results', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.endQuiz();

    expect(stats.recordSessionEnd).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/quiz', 'rt', 'report'], {
      state: { results: [], quizTitle: 'Logic Quiz' },
    });
  });

  it('toggling an already-checked entry does nothing', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.toggle(0, 'A');
    fixture.componentInstance.check();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const selectedBefore = fixture.componentInstance.entries()[0].selected;

    fixture.componentInstance.toggle(0, 'B');

    expect(fixture.componentInstance.entries()[0].selected).toEqual(selectedBefore);
  });

  describe('option info icons', () => {
    const qInfo: RoundQuestion = {
      id: 'qi',
      prompt: 'PI',
      options: ['Straw Man', 'No trap — sound reasoning'],
      correctAnswers: ['Straw Man'],
      traitIds: ['kb1'],
      explanation: 'EI',
    };

    beforeEach(() => {
      engine.selectRound = vi.fn().mockReturnValueOnce([qInfo]).mockReturnValue([]);
    });

    async function load() {
      configure();
      const fixture = TestBed.createComponent(RoundPage);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    function infoButtons(fixture: Awaited<ReturnType<typeof load>>): HTMLButtonElement[] {
      return Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="option-info"]'),
      ) as HTMLButtonElement[];
    }

    it('renders an info button only for the option that matches a knowledge-base entry', async () => {
      const fixture = await load();

      expect(infoButtons(fixture).length).toBe(1);
    });

    it('labels the info button with the option name', async () => {
      const fixture = await load();

      expect(infoButtons(fixture)[0].getAttribute('aria-label')).toBe('Definition of Straw Man');
    });

    it('clicking the info button shows the definition and tip and marks it expanded', async () => {
      const fixture = await load();
      expect(fixture.nativeElement.querySelector('[data-testid="option-definition"]')).toBeNull();

      infoButtons(fixture)[0].click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('[data-testid="option-definition"]');
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain(kb[0].shortDefinition);
      expect(panel.textContent).toContain(kb[0].distinguishingTip);
      expect(infoButtons(fixture)[0].getAttribute('aria-expanded')).toBe('true');
    });

    it('clicking the info button does not select the option', async () => {
      const fixture = await load();

      infoButtons(fixture)[0].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.entries()[0].selected).toEqual([]);
      const checkboxes = fixture.nativeElement.querySelectorAll(
        '[data-testid="option"]',
      ) as NodeListOf<HTMLInputElement>;
      for (const checkbox of Array.from(checkboxes)) {
        expect(checkbox.checked).toBe(false);
      }
    });

    it('clicking the info button again hides the definition', async () => {
      const fixture = await load();

      infoButtons(fixture)[0].click();
      fixture.detectChanges();
      infoButtons(fixture)[0].click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="option-definition"]')).toBeNull();
      expect(infoButtons(fixture)[0].getAttribute('aria-expanded')).toBe('false');
    });
  });
});
