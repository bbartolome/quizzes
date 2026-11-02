import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CalibrationHomePage } from './calibration-home-page';
import { CalibrationBank, PendingRound, TwoWayItem } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { MemoryStorage } from '../../../testing/memory-storage';

describe('CalibrationHomePage', () => {
  const QUIZ_ID = 'calibration';

  const entry: QuizManifestEntry = {
    id: QUIZ_ID,
    title: 'Calibration Quiz',
    description: 'How sure are you, really?',
    icon: 'icon',
    version: 1,
    dataPath: 'data/calibration/',
    order: 2,
    kind: 'calibration',
    format: 'two-way',
  };

  function makeItem(n: number): TwoWayItem {
    return {
      id: `i${n}`,
      prompt: `Prompt ${n}`,
      options: [`Alpha${n}`, `Beta${n}`],
      correct: 0,
      topic: 'science',
      fact: `Fact ${n}`,
      source: { label: 'Source', url: 'https://example.com' },
    };
  }

  const bank: CalibrationBank = { version: 1, items: [makeItem(1), makeItem(2), makeItem(3)] };

  function completePending(): PendingRound {
    return {
      bankVersion: 1,
      items: bank.items.map((item) => ({ itemId: item.id, swapped: false })),
      picks: Object.fromEntries(bank.items.map((item) => [item.id, { pick: 0, confidence: 80 }])),
    };
  }

  const basicEntry: QuizManifestEntry = {
    id: 'calibration-basic',
    title: 'Confidence: Basic',
    description: 'Easier questions and shorter rounds.',
    icon: 'icon',
    version: 1,
    dataPath: 'data/quizzes/calibration-basic/',
    order: 4,
    kind: 'calibration',
    format: 'two-way',
    roundSize: 10,
  };

  let quizData: { loadManifest: ReturnType<typeof vi.fn> };
  let bankService: { loadBank: ReturnType<typeof vi.fn> };
  let history: CalibrationHistoryService;
  let navigate: ReturnType<typeof vi.spyOn>;

  function configure(id: string = QUIZ_ID): void {
    TestBed.configureTestingModule({
      imports: [CalibrationHomePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id })) },
        },
        { provide: QuizDataService, useValue: quizData },
        { provide: CalibrationBankService, useValue: bankService },
      ],
    });
    history = TestBed.inject(CalibrationHistoryService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  async function settle(fixture: ComponentFixture<CalibrationHomePage>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(): Promise<ComponentFixture<CalibrationHomePage>> {
    const fixture = TestBed.createComponent(CalibrationHomePage);
    await settle(fixture);
    return fixture;
  }

  function root(fixture: ComponentFixture<CalibrationHomePage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttonByText(
    fixture: ComponentFixture<CalibrationHomePage>,
    pattern: RegExp,
  ): HTMLButtonElement | undefined {
    return Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      pattern.test(b.textContent ?? ''),
    );
  }

  function roundLink(
    fixture: ComponentFixture<CalibrationHomePage>,
  ): HTMLAnchorElement | undefined {
    return Array.from(root(fixture).querySelectorAll<HTMLAnchorElement>('a')).find((a) =>
      /(start|resume) round/i.test(a.textContent ?? ''),
    );
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    quizData = { loadManifest: vi.fn(() => of({ quizzes: [entry] })) };
    bankService = { loadBank: vi.fn(() => of(bank)) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the manifest title and description', async () => {
    configure();
    const fixture = await render();

    expect(root(fixture).textContent).toContain('Calibration Quiz');
    expect(root(fixture).textContent).toContain('How sure are you, really?');
  });

  describe('design system (S10)', () => {
    it('renders a page shell with the back link to the library', async () => {
      configure();
      const fixture = await render();

      expect(root(fixture).querySelector('ui-page-shell')).not.toBeNull();
      expect(root(fixture).querySelector('[data-testid="back-home"]')?.textContent).toContain(
        'Back to library',
      );
    });

    it('renders Start round as a primary Button', async () => {
      configure();
      const fixture = await render();

      expect(roundLink(fixture)?.hasAttribute('uiButton')).toBe(true);
      expect(roundLink(fixture)?.className).toContain('bg-accent');
    });
  });

  describe('with no history', () => {
    it('offers Start round and prompts for a first round instead of a sparkline', async () => {
      configure();
      const fixture = await render();

      const link = roundLink(fixture);
      expect(link?.textContent).toContain('Start round');
      expect(link?.getAttribute('href')).toMatch(/\/calibration\/calibration\/round$/);
      expect(root(fixture).textContent).toContain('Play a round to start your calibration curve');
      expect(root(fixture).querySelector('app-calibration-sparkline')).toBeNull();
      expect(buttonByText(fixture, /start over/i)).toBeUndefined();
      expect(root(fixture).textContent).not.toContain("You've seen every item");
    });
  });

  describe('with a pending round', () => {
    it('reads Resume round and offers Start over', async () => {
      configure();
      history.savePending(QUIZ_ID, {
        bankVersion: 1,
        items: [{ itemId: 'i1', swapped: false }],
        picks: {},
      });
      const fixture = await render();

      expect(roundLink(fixture)?.textContent).toContain('Resume round');
      expect(root(fixture).textContent).not.toContain('Start round');
      expect(buttonByText(fixture, /start over/i)).toBeDefined();
    });

    it('Start over discards the pending round and navigates to the round page', async () => {
      configure();
      history.savePending(QUIZ_ID, {
        bankVersion: 1,
        items: [{ itemId: 'i1', swapped: false }],
        picks: {},
      });
      const fixture = await render();

      buttonByText(fixture, /start over/i)!.click();
      await settle(fixture);

      expect(history.getPending(QUIZ_ID)).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/calibration', QUIZ_ID, 'round']);
    });
  });

  describe('after a submitted round', () => {
    beforeEach(() => {
      configure();
      history.submit(QUIZ_ID, bank, completePending());
    });

    it('shows the lifetime sparkline, Skill score and rounds played', async () => {
      const fixture = await render();
      const text = root(fixture).textContent ?? '';

      expect(root(fixture).querySelector('app-calibration-sparkline')).not.toBeNull();
      expect(text).not.toContain('Play a round to start your calibration curve');
      expect(text).toContain('Skill score');
      expect(text).toMatch(/1\s+round/i);
    });

    it('notes that items will repeat once every item has been seen', async () => {
      const fixture = await render();

      expect(root(fixture).textContent).toContain("You've seen every item. Some will repeat.");
    });
  });

  describe('when the bank cannot load', () => {
    it('shows "Couldn\'t load this quiz" and Retry reloads', async () => {
      bankService = {
        loadBank: vi
          .fn()
          .mockReturnValueOnce(throwError(() => new Error('offline')))
          .mockReturnValue(of(bank)),
      };
      configure();
      const fixture = await render();

      expect(root(fixture).textContent).toContain("Couldn't load this quiz");
      expect(root(fixture).textContent).not.toContain('Calibration Quiz');

      buttonByText(fixture, /retry/i)!.click();
      await settle(fixture);

      expect(bankService.loadBank).toHaveBeenCalledTimes(2);
      expect(root(fixture).textContent).not.toContain("Couldn't load this quiz");
      expect(root(fixture).textContent).toContain('Calibration Quiz');
    });
  });

  describe('Confidence: Basic first-run explainer', () => {
    function useBasic(): void {
      quizData = { loadManifest: vi.fn(() => of({ quizzes: [basicEntry] })) };
    }

    it('shows the explainer above Start round on a new Basic home', async () => {
      useBasic();
      configure('calibration-basic');
      const fixture = await render();
      const text = root(fixture).textContent ?? '';

      expect(text).toContain('Sure should be right about 9 times in 10');
      expect(text).toContain('Sure (90% or more)');
      expect(text).toContain('Fairly sure (70–80%)');
      expect(text).toContain('Guessing (60% or less)');

      const explainer = root(fixture).querySelector('[data-testid="basic-explainer"]')!;
      const startLink = roundLink(fixture)!;
      expect(
        explainer.compareDocumentPosition(startLink) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('hides the explainer once a round has been submitted on Basic', async () => {
      useBasic();
      configure('calibration-basic');
      history.submit('calibration-basic', bank, completePending());
      const fixture = await render();

      expect(root(fixture).querySelector('[data-testid="basic-explainer"]')).toBeNull();
    });

    it('does not show the explainer on the standard Confidence home', async () => {
      configure();
      const fixture = await render();

      expect(root(fixture).querySelector('[data-testid="basic-explainer"]')).toBeNull();
    });
  });
});
