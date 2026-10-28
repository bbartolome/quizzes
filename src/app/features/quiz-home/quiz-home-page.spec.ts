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

  // --- Design system (S5, docs/specs/design-system.md §6, §7) ---

  async function renderPage() {
    configure();
    const fixture = TestBed.createComponent(QuizHomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function buttonNamed(root: HTMLElement, selector: string, label: string): Element | undefined {
    return [...root.querySelectorAll(selector)].find((el) => el.textContent?.trim() === label);
  }

  function chipFor(root: HTMLElement, label: string): Element | undefined {
    return [...root.querySelectorAll('label[uiChip]')].find((el) => el.textContent?.includes(label));
  }

  it('puts the quiz title in the page shell h1', async () => {
    const fixture = await renderPage();

    expect(fixture.nativeElement.querySelector('h1.type-title')?.textContent?.trim()).toBe(
      'Logic Quiz',
    );
  });

  it('makes Start quiz a primary Button linking to the round', async () => {
    const fixture = await renderPage();

    const start = buttonNamed(fixture.nativeElement, 'a[uiButton][variant="primary"]', 'Start quiz');
    expect(start?.getAttribute('href')).toContain('/quiz/rt/round');
  });

  it('shows Weak spots as a secondary Button once the quiz has stats', async () => {
    stats.getStats = vi.fn(() => ({ perTrait: { kb1: {} } }));
    const fixture = await renderPage();

    expect(
      buttonNamed(fixture.nativeElement, 'a[uiButton][variant="secondary"]', 'Weak spots'),
    ).toBeDefined();
  });

  it('keeps the round filters in a Card section', async () => {
    const fixture = await renderPage();

    expect(
      fixture.nativeElement.querySelector('section[uiCard][aria-label="Round filters"]'),
    ).not.toBeNull();
  });

  it('renders the category and trait toggles as Chips', async () => {
    const fixture = await renderPage();

    expect(fixture.nativeElement.querySelectorAll('button[uiChip]')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('label[uiChip]')).toHaveLength(3);
  });

  it('gives a selected trait Chip the selected look', async () => {
    const fixture = await renderPage();
    expect(chipFor(fixture.nativeElement, 'Anchoring')?.className).not.toContain(
      'bg-accent-subtle',
    );

    clickChip(fixture, 'Anchoring');
    fixture.detectChanges();

    expect(chipFor(fixture.nativeElement, 'Anchoring')?.className).toContain('bg-accent-subtle');
  });

  it('shows Clear selection as a secondary Button only while a trait is chosen', async () => {
    const fixture = await renderPage();
    const clearSelector = 'button[uiButton][variant="secondary"]';
    expect(buttonNamed(fixture.nativeElement, clearSelector, 'Clear selection')).toBeUndefined();

    clickChip(fixture, 'Anchoring');
    fixture.detectChanges();

    expect(buttonNamed(fixture.nativeElement, clearSelector, 'Clear selection')).toBeDefined();
  });
});
