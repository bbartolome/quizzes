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
  Template,
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

  const tpl: Template = {
    id: 'tpl1',
    pattern: 'pattern',
    slots: {},
    correctAnswers: ['Straw Man'],
    distractors: ['B'],
    category: 'fallacy',
    explanation: 'explanation',
  };

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
  const fixedQuestions: RoundQuestion[] = [q1, q2];

  const generatedQuestion: RoundQuestion = {
    id: 'gen1',
    prompt: 'Generated',
    options: ['A', 'B'],
    correctAnswers: ['A'],
    traitIds: [],
    explanation: 'GenE',
    sourceTemplateId: 'tpl1',
  };

  let quizData: { loadManifest: ReturnType<typeof vi.fn>; loadQuizBundle: ReturnType<typeof vi.fn> };
  let stats: {
    migrateVersion: ReturnType<typeof vi.fn>;
    getWeakTraits: ReturnType<typeof vi.fn>;
    recordResult: ReturnType<typeof vi.fn>;
  };
  let engine: { selectRound: ReturnType<typeof vi.fn>; score: ReturnType<typeof vi.fn> };
  let templateGenerator: { render: ReturnType<typeof vi.fn> };

  function configure(
    queryParams: Record<string, string> = {},
    templates: Template[] = [],
  ): void {
    quizData.loadQuizBundle = vi.fn(() => of({ questions: [], templates, knowledgeBase: kb }));

    TestBed.configureTestingModule({
      imports: [RoundPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'rt' }),
              queryParamMap: convertToParamMap(queryParams),
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

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    quizData = {
      loadManifest: vi.fn(() => of({ quizzes: [entry] })),
      loadQuizBundle: vi.fn(() => of({ questions: [], templates: [], knowledgeBase: kb })),
    };
    stats = {
      migrateVersion: vi.fn(),
      getWeakTraits: vi.fn(() => []),
      recordResult: vi.fn(),
    };
    engine = {
      selectRound: vi.fn(() => fixedQuestions),
      score: vi.fn((question: RoundQuestion, selected: string[]) => ({
        question,
        selected,
        correct: true,
        missed: [],
        extra: [],
      })),
    };
    templateGenerator = { render: vi.fn(() => generatedQuestion) };
  });

  it('loads the quiz bundle, migrates stats, and exposes the quiz title and questions', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.quizTitle()).toBe('Logic Quiz');
    expect(stats.migrateVersion).toHaveBeenCalledWith('rt', 3, ['kb1']);
    expect(fixture.componentInstance.questions()).toEqual([q2, q1]);
  });

  it('requests a 4-question round with no template when no template matches', async () => {
    configure({}, []);
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(engine.selectRound).toHaveBeenCalledWith(
      { questions: [] },
      expect.objectContaining({ count: 4 }),
    );
    expect(templateGenerator.render).not.toHaveBeenCalled();
  });

  it('requests a 3-question round and renders the picked template, merging it into the questions', async () => {
    configure({}, [tpl]);
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(engine.selectRound).toHaveBeenCalledWith(
      { questions: [] },
      expect.objectContaining({ count: 3 }),
    );
    expect(templateGenerator.render).toHaveBeenCalledWith(tpl);
    expect(fixture.componentInstance.questions()).toEqual([q2, generatedQuestion, q1]);
  });

  it('passes weak-trait weights to selectRound when the weakTraits filter is set', async () => {
    stats.getWeakTraits = vi.fn(() => ['kb1']);
    configure({ weakTraits: 'true' }, []);
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(stats.getWeakTraits).toHaveBeenCalledWith('rt');
    expect(engine.selectRound).toHaveBeenCalledWith(
      { questions: [] },
      expect.objectContaining({ weakTraitWeights: { kb1: 1 } }),
    );
  });

  it('toggles option selections per question', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.toggle('q1', 'A');
    expect(fixture.componentInstance.selections()['q1']).toEqual(['A']);

    fixture.componentInstance.toggle('q1', 'A');
    expect(fixture.componentInstance.selections()['q1']).toEqual([]);
  });

  it('canSubmit is false until every question has a selection, then true', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.canSubmit()).toBe(false);

    fixture.componentInstance.toggle('q1', 'A');
    expect(fixture.componentInstance.canSubmit()).toBe(false);

    fixture.componentInstance.toggle('q2', 'B');
    expect(fixture.componentInstance.canSubmit()).toBe(true);
  });

  it('submit scores every question, records each result, and navigates to the report with state', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.toggle('q1', 'A');
    fixture.componentInstance.toggle('q2', 'B');
    fixture.componentInstance.submit();

    expect(engine.score).toHaveBeenCalledWith(q1, ['A']);
    expect(engine.score).toHaveBeenCalledWith(q2, ['B']);
    expect(stats.recordResult).toHaveBeenCalledTimes(2);
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/quiz', 'rt', 'report'],
      expect.objectContaining({
        state: expect.objectContaining({ quizTitle: 'Logic Quiz' }),
      }),
    );
  });

  it('renders one fieldset per question with its options and a submit button', async () => {
    configure();
    const fixture = TestBed.createComponent(RoundPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const questionEls = fixture.nativeElement.querySelectorAll('[data-testid="question"]');
    expect(questionEls.length).toBe(2);

    const optionEls = fixture.nativeElement.querySelectorAll('[data-testid="option"]');
    expect(optionEls.length).toBe(4);

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-round"]');
    expect(submitBtn.disabled).toBe(true);
  });
});
