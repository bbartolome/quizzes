import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Concept, QuizManifestEntry, QuizStats } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { PracticeService } from '../../core/services/practice.service';
import { FakePracticeService } from '../../../testing/fake-practice.service';
import { MemoryStorage } from '../../../testing/memory-storage';
import { LibraryPage } from './library-page';

const biasesEntry: QuizManifestEntry = {
  id: 'biases',
  title: 'Biases',
  description: 'Flash cards on biases.',
  icon: 'x',
  version: 1,
  order: 1,
  kind: 'biases',
};
const fallaciesEntry: QuizManifestEntry = { ...biasesEntry, id: 'fallacies', title: 'Fallacies', kind: 'fallacies', order: 2 };
const trapsEntry: QuizManifestEntry = {
  id: 'reasoning-traps',
  title: 'Reasoning Traps',
  description: 'Spot the trap.',
  icon: 'x',
  version: 1,
  dataPath: 'data/reasoning-traps/',
  order: 3,
  kind: 'traps',
};

const concept = (id: string, type: Concept['type']): Concept => ({
  id,
  name: id,
  type,
  shortDefinition: 'short',
  longExplanation: 'long',
  example: 'example',
});

// The knowledge base decides M: two biases and one fallacy.
const kb = {
  concepts: [concept('anchoring', 'bias'), concept('framing', 'bias'), concept('strawman', 'fallacy')],
  pairs: [],
};

const stats = (quizId: string, perTrait: QuizStats['perTrait']): QuizStats => ({
  quizId,
  version: 1,
  perTrait,
  streak: 0,
  roundsPlayed: 1,
});

function cardFor(root: ParentNode, title: string): HTMLAnchorElement | undefined {
  return [...root.querySelectorAll<HTMLAnchorElement>('a[uiCard]')].find(
    (card) => card.querySelector('h3')?.textContent?.trim() === title,
  );
}

describe('LibraryPage concepts practised (P6)', () => {
  let statsById: Record<string, QuizStats>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    statsById = {
      biases: stats('biases', {
        anchoring: { traitId: 'anchoring', correct: 3, attempted: 4 }, // Practised (0.70, 4 attempts)
        framing: { traitId: 'framing', correct: 1, attempted: 1 }, // Learning
      }),
      fallacies: stats('fallacies', {
        strawman: { traitId: 'strawman', correct: 8, attempted: 8 }, // Practised
      }),
      'reasoning-traps': stats('reasoning-traps', {
        // The pseudo-trait is not a knowledge-base id and must not count.
        'sound-reasoning': { traitId: 'sound-reasoning', correct: 10, attempted: 10 },
      }),
    };
    const practice = new FakePracticeService();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: QuizDataService,
          useValue: {
            loadManifest: vi.fn(() => of({ quizzes: [trapsEntry, biasesEntry, fallaciesEntry] })),
            loadKnowledgeBase: vi.fn(() => of(kb)),
          },
        },
        { provide: StatsService, useValue: { getStats: vi.fn((id: string) => statsById[id]) } },
        { provide: PracticeService, useValue: practice },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows Concepts practised N / M on the Biases card, with M from the knowledge base', async () => {
    const root = await render();
    const card = cardFor(root, 'Biases');
    expect(card?.textContent).toMatch(/Concepts practised\s*1 \/ 2/);
  });

  it('shows the fallacy count on the Fallacies card', async () => {
    const root = await render();
    const card = cardFor(root, 'Fallacies');
    expect(card?.textContent).toMatch(/Concepts practised\s*1 \/ 1/);
  });

  it('counts only knowledge-base ids on the Reasoning Traps card', async () => {
    const root = await render();
    const card = cardFor(root, 'Reasoning Traps');
    expect(card?.textContent).toMatch(/Concepts practised\s*0 \/ 3/);
  });
});
