import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { GlossaryPage } from './glossary-page';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { ConfusedPair, Concept, QuizManifestEntry } from '../../core/models/quiz.models';

describe('GlossaryPage', () => {
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
    shortDefinition: 'Misrepresents an argument.',
    longExplanation: 'Long explanation of strawman.',
    example: 'Example of strawman.',
    spottingTip: 'Strawman misrepresents the argument.',
  };
  const slipperySlope: Concept = {
    id: 'slippery-slope',
    name: 'Slippery Slope',
    type: 'fallacy',
    shortDefinition: 'Chains unlikely consequences.',
    longExplanation: 'Long explanation of slippery slope.',
    example: 'Example of slippery slope.',
    spottingTip: 'tip',
  };
  const kb: Concept[] = [strawman, slipperySlope];
  const pairs: ConfusedPair[] = [
    { concepts: ['strawman', 'slippery-slope'], tip: 'Strawman misrepresents the argument.' },
  ];

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
      loadQuizBundle: vi.fn(() =>
        of({ questions: [], templates: [], knowledgeBase: { concepts: kb, pairs } }),
      ),
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
    expect(fixture.componentInstance.kb()).toEqual({ concepts: kb, pairs });
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

  it('renders one pair per confused partner, showing its name and the pair tip', async () => {
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

  // --- Design system (S6, docs/specs/design-system.md §6, §7, §12) ---

  async function renderPage() {
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function renderWithDetail() {
    const fixture = await renderPage();
    fixture.nativeElement.querySelector('[data-testid="trap"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('puts the quiz title in the one page h1 and drops the header bar', async () => {
    const fixture = await renderPage();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1.type-title')?.textContent?.trim()).toBe('Logic Quiz');
    expect(root.querySelector('header')).toBeNull();
  });

  it('reads "← Back to <quiz title>" in the shell back link', async () => {
    const fixture = await renderPage();
    const backHome = fixture.nativeElement.querySelector('[data-testid="back-home"]');

    expect(backHome.textContent?.trim()).toBe('← Back to Logic Quiz');
  });

  it('keeps a back link with a fallback label while the manifest is still loading', async () => {
    quizData.loadManifest = vi.fn(() => NEVER);
    configure();
    const fixture = TestBed.createComponent(GlossaryPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const backHome = fixture.nativeElement.querySelector('[data-testid="back-home"]');
    expect(backHome.textContent?.trim()).toBe('← Back to quiz');
  });

  it('renders each trap row as an interactive Card', async () => {
    const fixture = await renderPage();
    const traps = [...fixture.nativeElement.querySelectorAll('[data-testid="trap"][uiCard]')];

    expect(traps).toHaveLength(2);
    traps.forEach((trap) => expect([...trap.classList]).toContain('hover:shadow-md'));
  });

  it('marks the chosen trap with the selected border and background', async () => {
    const fixture = await renderWithDetail();
    const [chosen, other] = [...fixture.nativeElement.querySelectorAll('[data-testid="trap"]')];

    expect([...chosen.classList]).toEqual(
      expect.arrayContaining(['border-accent', 'bg-accent-subtle']),
    );
    expect([...other.classList]).not.toContain('border-accent');
  });

  it('renders the detail as a raised Card with the concept name as its card heading', async () => {
    const fixture = await renderWithDetail();
    const detail = fixture.nativeElement.querySelector('[data-testid="detail"]');

    expect(detail.hasAttribute('uiCard')).toBe(true);
    expect([...detail.classList]).toEqual(expect.arrayContaining(['bg-raised', 'border-default']));
    expect(detail.querySelector('h3.type-card')?.textContent?.trim()).toBe('Strawman');
  });

  it('renders each pair as a sunken Card with its tip in a Callout', async () => {
    const fixture = await renderWithDetail();
    const pair = fixture.nativeElement.querySelector('[data-testid="pair"]');

    expect(pair.hasAttribute('uiCard')).toBe(true);
    expect([...pair.classList]).toContain('bg-sunken');
    expect(pair.querySelector('ui-callout')?.textContent).toContain(
      'Strawman misrepresents the argument.',
    );
  });

  it('makes the quiz-pair link a link-variant Button', async () => {
    const fixture = await renderWithDetail();
    const link = fixture.nativeElement.querySelector('[data-testid="quiz-pair"]');

    expect(link.hasAttribute('uiButton')).toBe(true);
    expect(link.getAttribute('variant')).toBe('link');
  });

  it('lays the trap list and detail out on the glossary-grid track', async () => {
    const fixture = await renderWithDetail();
    const trap = fixture.nativeElement.querySelector('[data-testid="trap"]');

    expect([...trap.closest('ul').parentElement.classList]).toContain('md:glossary-grid');
  });

  it('styles the search input with the token input border', async () => {
    const fixture = await renderPage();
    const search = fixture.nativeElement.querySelector('[data-testid="search"]');

    expect([...search.classList]).toContain('border-strong');
  });
});
