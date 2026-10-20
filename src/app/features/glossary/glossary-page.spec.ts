import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { GlossaryPage } from './glossary-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { KnowledgeBaseEntry, QuizManifestEntry } from '../../core/models/quiz.models';

describe('GlossaryPage', () => {
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
    longExplanation: 'Long explanation of strawman.',
    example: 'Example of strawman.',
    commonlyConfusedWith: ['slippery-slope'],
    distinguishingTip: 'Strawman misrepresents the argument.',
  };
  const slipperySlope: KnowledgeBaseEntry = {
    id: 'slippery-slope',
    name: 'Slippery Slope',
    type: 'fallacy',
    shortDefinition: 'Chains unlikely consequences.',
    longExplanation: 'Long explanation of slippery slope.',
    example: 'Example of slippery slope.',
    commonlyConfusedWith: [],
    distinguishingTip: 'tip',
  };
  const kb: KnowledgeBaseEntry[] = [strawman, slipperySlope];

  let quizData: {
    loadManifest: ReturnType<typeof vi.fn>;
    loadQuizBundle: ReturnType<typeof vi.fn>;
  };

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [GlossaryPage],
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
    quizData = {
      loadManifest: vi.fn(() => of({ quizzes: [entry] })),
      loadQuizBundle: vi.fn(() => of({ questions: [], templates: [], knowledgeBase: kb })),
    };
  });

  it('loads the manifest and bundle for the route id, setting quizTitle and kb', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(quizData.loadManifest).toHaveBeenCalled();
    expect(quizData.loadQuizBundle).toHaveBeenCalledWith(entry);
    expect(fixture.componentInstance.quizTitle()).toBe('Logic Quiz');
    expect(fixture.componentInstance.kb()).toEqual(kb);
  });

  it('renders one trap button per filtered entry, unfiltered by default', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const traps = fixture.nativeElement.querySelectorAll('[data-testid="trap"]');
    expect(traps.length).toBe(2);
  });

  it('filters the trap buttons via the search input', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const search = fixture.nativeElement.querySelector('[data-testid="search"]');
    search.value = 'straw';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const traps = fixture.nativeElement.querySelectorAll('[data-testid="trap"]');
    expect(traps.length).toBe(1);
    expect(traps[0].textContent).toContain('Strawman');
  });

  it('does not render the detail panel when nothing is selected', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="detail"]')).toBeFalsy();
  });

  it('shows the detail panel for the selected entry when a trap is clicked', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const traps = fixture.nativeElement.querySelectorAll('[data-testid="trap"]');
    traps[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const detail = fixture.nativeElement.querySelector('[data-testid="detail"]');
    expect(detail.textContent).toContain('Strawman');
    expect(detail.textContent).toContain('Misrepresents an argument.');
    expect(detail.textContent).toContain('Long explanation of strawman.');
    expect(detail.textContent).toContain('Example of strawman.');
  });

  it("renders one pair per commonlyConfusedWith entry, showing its name and the selected entry's tip", async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const traps = fixture.nativeElement.querySelectorAll('[data-testid="trap"]');
    traps[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const pairs = fixture.nativeElement.querySelectorAll('[data-testid="pair"]');
    expect(pairs.length).toBe(1);
    expect(pairs[0].textContent).toContain('Slippery Slope');
    expect(pairs[0].textContent).toContain('Strawman misrepresents the argument.');
  });

  it('links each pair to a traits-filtered round quiz for the two confused entries', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="trap"]').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const quizPairLink = fixture.nativeElement.querySelector('[data-testid="quiz-pair"]');
    expect(quizPairLink.getAttribute('href')).toBe('/quiz/rt/round?traits=strawman,slippery-slope');
  });

  it('renders a back-home link pointing at the current quiz', async () => {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const backHome = fixture.nativeElement.querySelector('[data-testid="back-home"]');
    expect(backHome.getAttribute('href')).toBe('/quiz/rt');
  });
});
