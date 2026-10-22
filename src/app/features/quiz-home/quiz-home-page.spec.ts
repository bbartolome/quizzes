import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QuizHomePage } from './quiz-home-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { Concept, QuizManifestEntry } from '../../core/models/quiz.models';

describe('QuizHomePage', () => {
  const entry: QuizManifestEntry = {
    id: 'rt',
    title: 'Logic Quiz',
    description: 'desc',
    icon: 'icon',
    accent: 'accent',
    version: 1,
    dataPath: 'data/rt/',
    order: 1,
    kind: 'traps',
  };

  const strawMan: Concept = {
    id: 'kb1',
    name: 'Straw man',
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    spottingTip: 'tip',
  };
  const adHominem: Concept = {
    id: 'kb2',
    name: 'Ad hominem',
    type: 'fallacy',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    spottingTip: 'tip',
  };
  const anchoring: Concept = {
    id: 'kb3',
    name: 'Anchoring',
    type: 'bias',
    shortDefinition: 'short',
    longExplanation: 'long',
    example: 'example',
    spottingTip: 'tip',
  };
  const kb: Concept[] = [strawMan, adHominem, anchoring];

  let quizData: {
    loadManifest: ReturnType<typeof vi.fn>;
    loadQuizBundle: ReturnType<typeof vi.fn>;
  };
  let stats: { getStats: ReturnType<typeof vi.fn> };

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [QuizHomePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'rt' })) },
        },
        { provide: QuizDataService, useValue: quizData },
        { provide: StatsService, useValue: stats },
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
    stats = {
      getStats: vi.fn(() => ({ perTrait: {} })),
    };
  });

  function chipLabels(fixture: { nativeElement: HTMLElement }): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][aria-label]',
      ),
    ).map((el) => el.getAttribute('aria-label') ?? '');
  }

  function clickCategory(fixture: { nativeElement: HTMLElement }, label: string): void {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.trim() === label);
    btn?.dispatchEvent(new Event('click'));
  }

  function clickChip(fixture: { nativeElement: HTMLElement }, label: string): void {
    const input = fixture.nativeElement.querySelector<HTMLInputElement>(
      `input[type="checkbox"][aria-label="${label}"]`,
    );
    input?.dispatchEvent(new Event('change'));
  }

  it("shows all 3 chips when category is 'Both'", async () => {
    configure();
    const fixture = TestBed.createComponent(QuizHomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(chipLabels(fixture)).toEqual(['Straw man', 'Ad hominem', 'Anchoring']);
  });

  it("shows only fallacy chips for 'Fallacy' and only Anchoring for 'Bias'", async () => {
    configure();
    const fixture = TestBed.createComponent(QuizHomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    clickCategory(fixture, 'Fallacy');
    fixture.detectChanges();
    expect(chipLabels(fixture)).toEqual(['Straw man', 'Ad hominem']);

    clickCategory(fixture, 'Bias');
    fixture.detectChanges();
    expect(chipLabels(fixture)).toEqual(['Anchoring']);
  });

  it('removes a selected trait from the selection when switching category hides its chip', async () => {
    configure();
    const fixture = TestBed.createComponent(QuizHomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    clickChip(fixture, 'Anchoring');
    fixture.detectChanges();

    clickCategory(fixture, 'Fallacy');
    fixture.detectChanges();

    const startLink = fixture.nativeElement.querySelector('a[href*="/quiz/rt/round"]');
    expect(startLink?.getAttribute('href') ?? '').not.toContain('traits=');
  });

  it('keeps a selected trait selected when switching to a category that still shows it', async () => {
    configure();
    const fixture = TestBed.createComponent(QuizHomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    clickChip(fixture, 'Straw man');
    fixture.detectChanges();

    clickCategory(fixture, 'Fallacy');
    fixture.detectChanges();

    const startLink = fixture.nativeElement.querySelector('a[href*="/quiz/rt/round"]');
    expect(startLink?.getAttribute('href') ?? '').toContain('traits=kb1');
  });
});
