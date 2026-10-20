import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CalibrationResultsPage } from './calibration-results-page';
import { CalibrationBank, FourWayItem, PendingRound, TwoWayItem } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { QuizManifestEntry } from '../../core/models/quiz.models';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('CalibrationResultsPage', () => {
  const QUIZ_ID = 'calibration';

  const twoWayEntry: QuizManifestEntry = {
    id: QUIZ_ID,
    title: 'Calibration',
    description: 'desc',
    icon: 'icon',
    accent: 'accent',
    version: 1,
    dataPath: 'data/calibration/',
    order: 2,
    kind: 'calibration',
    format: 'two-way',
  };

  const fourWayEntry: QuizManifestEntry = { ...twoWayEntry, format: 'four-way' };

  const source = { label: 'Source', url: 'https://example.com' };

  function twoWayItem(n: number, correct: 0 | 1): TwoWayItem {
    return {
      id: `i${n}`,
      prompt: `Prompt ${n}`,
      options: [`Alpha${n}`, `Beta${n}`],
      correct,
      topic: 'science',
      fact: `Fact ${n}`,
      source,
    };
  }

  function fourWayItem(n: number): FourWayItem {
    return {
      id: `i${n}`,
      prompt: `Prompt ${n}`,
      options: [`Alpha${n}`, `Beta${n}`],
      truth: [true, false],
      topic: 'science',
      facts: [`Fact A${n}`, `Fact B${n}`],
      source,
    };
  }

  const twoWayBank: CalibrationBank = {
    version: 1,
    items: [twoWayItem(1, 0), twoWayItem(2, 1), twoWayItem(3, 0)],
  };

  const fourWayBank: CalibrationBank = {
    version: 1,
    items: [fourWayItem(1), fourWayItem(2), fourWayItem(3)],
  };

  let entry: QuizManifestEntry;
  let bank: CalibrationBank;
  let quizData: { loadManifest: ReturnType<typeof vi.fn> };
  let bankService: { loadBank: ReturnType<typeof vi.fn> };
  let history: CalibrationHistoryService;
  let navigate: ReturnType<typeof vi.spyOn>;

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [CalibrationResultsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: QUIZ_ID })) },
        },
        { provide: QuizDataService, useValue: quizData },
        { provide: CalibrationBankService, useValue: bankService },
      ],
    });
    history = TestBed.inject(CalibrationHistoryService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  function submitRound(pick: (itemIndex: number) => PendingRound['picks'][string]): void {
    const pending: PendingRound = {
      bankVersion: bank.version,
      items: bank.items.map((item) => ({ itemId: item.id, swapped: false })),
      picks: Object.fromEntries(bank.items.map((item, i) => [item.id, pick(i)])),
    };
    history.savePending(QUIZ_ID, pending);
    history.submit(QUIZ_ID, bank, pending);
  }

  const twoWayPick = (i: number) => ({ pick: i % 2, confidence: 80 });
  const fourWayPick = () => ({ pick: [true, false] as [boolean, boolean], confidence: 75 });

  async function render(): Promise<ComponentFixture<CalibrationResultsPage>> {
    const fixture = TestBed.createComponent(CalibrationResultsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<CalibrationResultsPage>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function has(fixture: ComponentFixture<CalibrationResultsPage>, selector: string): boolean {
    return (fixture.nativeElement as HTMLElement).querySelector(selector) !== null;
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    entry = twoWayEntry;
    bank = twoWayBank;
    quizData = { loadManifest: vi.fn(() => of({ quizzes: [entry] })) };
    bankService = { loadBank: vi.fn(() => of(bank)) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects to the home page, replacing the URL, when no round has been submitted', async () => {
    configure();

    await render();

    expect(navigate).toHaveBeenCalledWith(['/calibration', QUIZ_ID], { replaceUrl: true });
  });

  it('does not redirect once a round has been submitted', async () => {
    configure();
    submitRound(twoWayPick);

    await render();

    expect(navigate).not.toHaveBeenCalled();
  });

  describe('first round', () => {
    it('renders the chart, both cards and the review list', async () => {
      configure();
      submitRound(twoWayPick);

      const fixture = await render();

      expect(has(fixture, 'app-calibration-chart')).toBe(true);
      expect(has(fixture, 'app-skill-score-card')).toBe(true);
      expect(has(fixture, 'app-confidence-card')).toBe(true);
      expect(has(fixture, 'app-review-list')).toBe(true);
    });

    it('does not show the previous Skill score comparison', async () => {
      configure();
      submitRound(twoWayPick);

      const fixture = await render();

      expect(text(fixture)).not.toContain('Before this round');
    });

    it('shows the two-way help line with a guessing score of 50', async () => {
      configure();
      submitRound(twoWayPick);

      const fixture = await render();

      expect(text(fixture)).toContain('Guessing scores 50');
    });
  });

  describe('later rounds', () => {
    it('shows the Skill score from before this round', async () => {
      configure();
      submitRound(twoWayPick);
      submitRound(twoWayPick);

      const fixture = await render();

      expect(text(fixture)).toContain('Before this round');
    });
  });

  describe('four-way quiz', () => {
    it('shows the four-way help line with a guessing score of 25', async () => {
      entry = fourWayEntry;
      bank = fourWayBank;
      configure();
      submitRound(fourWayPick);

      const fixture = await render();

      expect(text(fixture)).toContain('Guessing scores 25');
    });
  });

  describe('load errors', () => {
    it('shows the unavailable message when the bank fails to load', async () => {
      bankService.loadBank = vi.fn(() => throwError(() => new Error('offline')));
      configure();

      const fixture = await render();

      expect(has(fixture, 'app-bank-unavailable')).toBe(true);
      expect(text(fixture)).toContain("Couldn't load this quiz");
      expect(has(fixture, 'app-skill-score-card')).toBe(false);
    });
  });
});
