import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CalibrationRoundPage } from './calibration-round-page';
import { CalibrationBank, PendingRound, TwoWayItem } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { CALIBRATION_RNG } from './draw';
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

describe('CalibrationRoundPage (two-way)', () => {
  const QUIZ_ID = 'calibration';

  const entry: QuizManifestEntry = {
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

  function makeItem(n: number, correct: 0 | 1): TwoWayItem {
    return {
      id: `i${n}`,
      prompt: `Prompt ${n}`,
      options: [`Alpha${n}`, `Beta${n}`],
      correct,
      topic: 'science',
      fact: `Fact ${n}`,
      source: { label: 'Source', url: 'https://example.com' },
    };
  }

  const bank: CalibrationBank = {
    version: 1,
    items: [makeItem(1, 0), makeItem(2, 1), makeItem(3, 0)],
  };

  function seededPending(swapped: boolean[] = [false, false, false]): PendingRound {
    return {
      bankVersion: 1,
      items: bank.items.map((item, i) => ({ itemId: item.id, swapped: swapped[i] })),
      picks: {},
    };
  }

  let quizData: { loadManifest: ReturnType<typeof vi.fn> };
  let bankService: { loadBank: ReturnType<typeof vi.fn> };
  let history: CalibrationHistoryService;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [CalibrationRoundPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: QUIZ_ID })) },
        },
        { provide: QuizDataService, useValue: quizData },
        { provide: CalibrationBankService, useValue: bankService },
        { provide: CALIBRATION_RNG, useValue: () => 0.9 },
      ],
    });
    history = TestBed.inject(CalibrationHistoryService);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  async function render(): Promise<ComponentFixture<CalibrationRoundPage>> {
    const fixture = TestBed.createComponent(CalibrationRoundPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: ComponentFixture<CalibrationRoundPage>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function root(fixture: ComponentFixture<CalibrationRoundPage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttonByLabel(fixture: ComponentFixture<CalibrationRoundPage>, label: string): HTMLButtonElement {
    const button = root(fixture).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!button) {
      throw new Error(`No button with aria-label "${label}"`);
    }
    return button;
  }

  function buttonByText(fixture: ComponentFixture<CalibrationRoundPage>, pattern: RegExp): HTMLButtonElement {
    const button = Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      pattern.test(b.textContent ?? ''),
    );
    if (!button) {
      throw new Error(`No button with text matching ${pattern}`);
    }
    return button;
  }

  async function click(fixture: ComponentFixture<CalibrationRoundPage>, button: HTMLElement): Promise<void> {
    button.click();
    await settle(fixture);
  }

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    quizData = { loadManifest: vi.fn(() => of({ quizzes: [entry] })) };
    bankService = { loadBank: vi.fn(() => of(bank)) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('drawing and resuming', () => {
    it('draws a new round and saves a pending round when none exists', async () => {
      configure();
      expect(history.getPending(QUIZ_ID)).toBeNull();

      await render();

      const pending = history.getPending(QUIZ_ID);
      expect(pending).not.toBeNull();
      expect(pending!.bankVersion).toBe(1);
      expect(pending!.items.map((d) => d.itemId).sort()).toEqual(['i1', 'i2', 'i3']);
      expect(pending!.picks).toEqual({});
    });

    it('resumes an existing pending round instead of drawing', async () => {
      configure();
      const seeded: PendingRound = {
        bankVersion: 1,
        items: [
          { itemId: 'i3', swapped: false },
          { itemId: 'i1', swapped: false },
          { itemId: 'i2', swapped: false },
        ],
        picks: { i3: { pick: 0, confidence: 70 } },
      };
      history.savePending(QUIZ_ID, seeded);

      const fixture = await render();

      expect(history.getPending(QUIZ_ID)).toEqual(seeded);
      // the first item shown is the first of the seeded order
      expect(root(fixture).textContent).toContain('Prompt 3');
      expect(buttonByLabel(fixture, 'Alpha3 70%').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      configure();
      history.savePending(QUIZ_ID, seededPending());
    });

    it('shows one prompt at a time and one progress dot per item', async () => {
      const fixture = await render();
      const text = root(fixture).textContent ?? '';

      expect(text).toContain('Prompt 1');
      expect(text).not.toContain('Prompt 2');
      expect(text).not.toContain('Prompt 3');

      for (const n of [1, 2, 3]) {
        expect(root(fixture).querySelectorAll(`button[aria-label="Item ${n}"]`).length).toBe(1);
      }
      expect(root(fixture).querySelector('button[aria-label="Item 4"]')).toBeNull();
      expect(buttonByLabel(fixture, 'Item 1').getAttribute('aria-current')).toBeTruthy();
      expect(buttonByLabel(fixture, 'Item 2').hasAttribute('aria-current')).toBe(false);
    });

    it('saves the pick in bank order and moves to the next item when a scale stop is tapped', async () => {
      const fixture = await render();

      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));

      expect(history.getPending(QUIZ_ID)!.picks['i1']).toEqual({ pick: 0, confidence: 80 });
      expect(root(fixture).textContent).toContain('Prompt 2');
      expect(root(fixture).textContent).not.toContain('Prompt 1');

      await click(fixture, buttonByLabel(fixture, 'Beta2 90%'));

      expect(history.getPending(QUIZ_ID)!.picks['i2']).toEqual({ pick: 1, confidence: 90 });
      expect(root(fixture).textContent).toContain('Prompt 3');
    });

    it('maps the on-screen side back to bank order on a swapped item', async () => {
      history.savePending(QUIZ_ID, seededPending([true, true, false]));
      const fixture = await render();

      // swapped: on-screen left is bank option 1 (Beta1)
      await click(fixture, buttonByLabel(fixture, 'Beta1 80%'));

      expect(history.getPending(QUIZ_ID)!.picks['i1']).toEqual({ pick: 1, confidence: 80 });
    });

    it('stores a 50% no-idea answer as the left on-screen side in bank order', async () => {
      history.savePending(QUIZ_ID, seededPending([true, true, false]));
      const fixture = await render();

      await click(fixture, buttonByLabel(fixture, '50% no idea'));

      expect(history.getPending(QUIZ_ID)!.picks['i1']).toEqual({ pick: 1, confidence: 50 });
    });

    it('opens an item from its dot and shows its current answer as pressed', async () => {
      const fixture = await render();
      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));
      expect(root(fixture).textContent).toContain('Prompt 2');

      await click(fixture, buttonByLabel(fixture, 'Item 1'));

      expect(root(fixture).textContent).toContain('Prompt 1');
      expect(buttonByLabel(fixture, 'Item 1').getAttribute('aria-current')).toBeTruthy();
      expect(buttonByLabel(fixture, 'Alpha1 80%').getAttribute('aria-pressed')).toBe('true');
      expect(buttonByLabel(fixture, 'Alpha1 70%').getAttribute('aria-pressed')).not.toBe('true');

      await click(fixture, buttonByLabel(fixture, 'Item 3'));
      expect(root(fixture).textContent).toContain('Prompt 3');
    });

    it('returns to the previous item with the Back control', async () => {
      const fixture = await render();
      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));
      expect(root(fixture).textContent).toContain('Prompt 2');

      await click(fixture, buttonByText(fixture, /back/i));

      expect(root(fixture).textContent).toContain('Prompt 1');
    });

    it('replaces an earlier answer when a revisited item is answered again', async () => {
      const fixture = await render();
      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));
      await click(fixture, buttonByLabel(fixture, 'Item 1'));

      await click(fixture, buttonByLabel(fixture, 'Beta1 60%'));

      expect(history.getPending(QUIZ_ID)!.picks['i1']).toEqual({ pick: 1, confidence: 60 });
    });
  });

  describe('submitting', () => {
    beforeEach(() => {
      configure();
      history.savePending(QUIZ_ID, seededPending());
    });

    it('keeps Submit round disabled until every item is answered, then enables it', async () => {
      const fixture = await render();
      expect(buttonByText(fixture, /submit round/i).disabled).toBe(true);

      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));
      await click(fixture, buttonByLabel(fixture, 'Beta2 90%'));
      expect(buttonByText(fixture, /submit round/i).disabled).toBe(true);

      await click(fixture, buttonByLabel(fixture, 'Alpha3 100%'));
      expect(buttonByText(fixture, /submit round/i).disabled).toBe(false);
    });

    it('records the round and navigates to the results', async () => {
      const fixture = await render();
      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));
      await click(fixture, buttonByLabel(fixture, 'Beta2 90%'));
      await click(fixture, buttonByLabel(fixture, 'Alpha3 100%'));
      expect(history.lastRound(QUIZ_ID)).toBeNull();

      await click(fixture, buttonByText(fixture, /submit round/i));

      expect(history.lastRound(QUIZ_ID)).not.toBeNull();
      expect(history.lastRound(QUIZ_ID)!.answers.length).toBe(3);
      expect(history.getPending(QUIZ_ID)).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/calibration', QUIZ_ID, 'results']);
    });

    it('shows no correctness before submit', async () => {
      const fixture = await render();
      await click(fixture, buttonByLabel(fixture, 'Alpha1 80%'));
      await click(fixture, buttonByLabel(fixture, 'Alpha2 80%'));
      await click(fixture, buttonByLabel(fixture, 'Alpha3 80%'));

      const text = root(fixture).textContent ?? '';
      expect(text).not.toMatch(/correct/i);
      expect(text).not.toMatch(/wrong/i);
    });
  });

  describe('bank unavailable', () => {
    it('shows the unavailable message and retries loading the bank', async () => {
      bankService.loadBank.mockReturnValue(throwError(() => new Error('offline')));
      configure();

      const fixture = await render();

      expect(root(fixture).textContent).toContain(
        "Couldn't load this quiz. Check your connection and try again.",
      );
      expect(bankService.loadBank).toHaveBeenCalledTimes(1);

      await click(fixture, buttonByText(fixture, /retry/i));

      expect(bankService.loadBank).toHaveBeenCalledTimes(2);
    });
  });
});
