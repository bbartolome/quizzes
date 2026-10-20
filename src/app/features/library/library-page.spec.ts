import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { CalibrationBankService } from '../calibration/calibration-bank.service';
import { CalibrationBank, PendingRound } from '../calibration/calibration.models';
import { CalibrationHistoryService } from '../calibration/calibration-history.service';
import { LibraryPage } from './library-page';

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

const trapsEntry: QuizManifestEntry = {
  id: 'reasoning-traps',
  title: 'Reasoning Traps',
  description: 'Spot the cognitive trap.',
  icon: 'brain',
  accent: '#2563eb',
  version: 1,
  dataPath: 'data/reasoning-traps/',
  order: 1,
  kind: 'traps',
};

const calibrationEntry: QuizManifestEntry = {
  id: 'calibration',
  title: 'Confidence Calibration',
  description: 'How sure are you, really?',
  icon: 'target',
  accent: '#059669',
  version: 1,
  dataPath: 'data/calibration/',
  order: 2,
  kind: 'calibration',
  format: 'two-way',
};

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: QuizDataService,
          useValue: {
            loadManifest: vi.fn(() => of({ quizzes: [trapsEntry, calibrationEntry] })),
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function cardHref(root: HTMLElement, title: string): string | null {
    const anchor = root.querySelector<HTMLAnchorElement>(`a[aria-label^="${title}"]`);
    return anchor ? anchor.getAttribute('href') : null;
  }

  it('links the traps card to /quiz/:id', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const href = cardHref(fixture.nativeElement, trapsEntry.title);
    expect(href).not.toBeNull();
    expect(href!.endsWith('/quiz/reasoning-traps')).toBe(true);
  });

  it('links the calibration card to /calibration/:id', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const href = cardHref(fixture.nativeElement, calibrationEntry.title);
    expect(href).not.toBeNull();
    expect(href!.endsWith('/calibration/calibration')).toBe(true);
  });
});

describe('LibraryPage calibration cards', () => {
  const bank: CalibrationBank = {
    version: 1,
    items: [
      {
        id: 'a',
        prompt: 'A or B?',
        options: ['A', 'B'],
        correct: 0,
        topic: 'history',
        fact: 'fact a',
        source: { label: 's', url: 'https://example.com/a' },
      },
      {
        id: 'b',
        prompt: 'C or D?',
        options: ['C', 'D'],
        correct: 1,
        topic: 'science',
        fact: 'fact b',
        source: { label: 's', url: 'https://example.com/b' },
      },
    ],
  };
  const loadBank = vi.fn((_entry: QuizManifestEntry) => of(bank));

  const manifest = { quizzes: [trapsEntry, calibrationEntry] };

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    manifest.quizzes = [trapsEntry, calibrationEntry];
    loadBank.mockReset();
    loadBank.mockReturnValue(of(bank));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: QuizDataService,
          useValue: { loadManifest: vi.fn(() => of(manifest)) },
        },
        { provide: CalibrationBankService, useValue: { loadBank } },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function playCalibrationRound(): void {
    const history = TestBed.inject(CalibrationHistoryService);
    const pending: PendingRound = {
      bankVersion: 1,
      items: [
        { itemId: 'a', swapped: false },
        { itemId: 'b', swapped: false },
      ],
      picks: { a: { pick: 0, confidence: 80 }, b: { pick: 1, confidence: 80 } },
    };
    history.savePending('calibration', pending);
    history.submit('calibration', bank, pending);
  }

  function playTrapsRound(): void {
    const stats = TestBed.inject(StatsService);
    const result = (correct: boolean) =>
      ({ question: { traitIds: ['t1'] }, selected: [], correct, missed: [], extra: [] }) as never;
    stats.recordResult('reasoning-traps', result(true));
    stats.recordResult('reasoning-traps', result(true));
    stats.recordResult('reasoning-traps', result(true));
    stats.recordResult('reasoning-traps', result(false));
    stats.recordSessionEnd('reasoning-traps');
  }

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function text(el: Element): string {
    return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function cardText(root: HTMLElement): string {
    return text(root.querySelector(`a[aria-label^="${calibrationEntry.title}"]`)!);
  }

  it('shows rounds played and Skill score N on the calibration card', async () => {
    playCalibrationRound();
    const root = await render();

    expect(cardText(root)).toMatch(/Rounds played\s*1/);
    expect(cardText(root)).toMatch(/Skill score:? 92/);
  });

  it('hides the Skill score before any round', async () => {
    const root = await render();

    expect(cardText(root)).not.toContain('Skill score');
  });

  it('has no Accuracy or Current streak rows on the calibration card', async () => {
    playCalibrationRound();
    const root = await render();

    expect(cardText(root)).not.toContain('Accuracy');
    expect(cardText(root)).not.toContain('Current streak');
  });

  it('adds calibration rounds to the header total', async () => {
    playTrapsRound();
    playCalibrationRound();
    const root = await render();

    expect(text(root.querySelector('header')!)).toContain('2 rounds played across all');
  });

  it('computes overall accuracy from Traps answers only', async () => {
    playTrapsRound();
    playCalibrationRound();
    const root = await render();

    expect(text(root.querySelector('header')!)).toContain('75% overall accuracy');
  });

  it('migrates a calibration history whose stored bankVersion differs from entry.version', async () => {
    playCalibrationRound();
    const key = 'stats:calibration:calibration';
    const stored = JSON.parse(localStorage.getItem(key)!);
    stored.bankVersion = 1;
    localStorage.setItem(key, JSON.stringify(stored));

    const bumped = { ...calibrationEntry, version: 2 };
    manifest.quizzes = [trapsEntry, bumped];
    loadBank.mockReturnValue(of({ ...bank, version: 2 }));

    await render();

    expect(loadBank).toHaveBeenCalledWith(bumped);
    expect(JSON.parse(localStorage.getItem(key)!).bankVersion).toBe(2);
  });

  it('clears calibration history on Reset all progress', async () => {
    playCalibrationRound();
    vi.stubGlobal('confirm', () => true);
    const root = await render();
    expect(localStorage.getItem('stats:calibration:calibration')).not.toBeNull();

    const reset = [...root.querySelectorAll('button')].find((b) =>
      text(b).includes('Reset all progress'),
    )!;
    reset.click();

    expect(localStorage.getItem('stats:calibration:calibration')).toBeNull();
  });
});
