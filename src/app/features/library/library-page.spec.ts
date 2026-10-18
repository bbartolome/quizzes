import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
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
