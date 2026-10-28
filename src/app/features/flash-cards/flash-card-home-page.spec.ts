import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FlashCardHomePage } from './flash-card-home-page';
import { StatsService } from '../../core/services/stats.service';
import { Concept, KnowledgeBase, QuizManifest, QuizStats } from '../../core/models/quiz.models';

const manifest: QuizManifest = {
  quizzes: [
    {
      id: 'biases',
      title: 'Biases',
      description: 'Cognitive biases to drill.',
      icon: 'icons/biases.svg',
      version: 1,
      order: 1,
      kind: 'biases',
    },
  ],
};

function concept(id: string, type: Concept['type']): Concept {
  return {
    id,
    name: `Name ${id}`,
    type,
    shortDefinition: `short ${id}`,
    longExplanation: `long ${id}`,
    example: `example ${id}`,
  };
}

const kb: KnowledgeBase = {
  concepts: [concept('b1', 'bias'), concept('f1', 'fallacy'), concept('b2', 'bias')],
  pairs: [],
};

function statsWith(perTrait: QuizStats['perTrait'], roundsPlayed: number): QuizStats {
  return { quizId: 'biases', version: 1, perTrait, streak: 0, roundsPlayed };
}

/** Renders the home page through a real route (biases/:id), so relative routerLinks resolve. */
async function setup(
  options: { routeId?: string; manifestFile?: QuizManifest; stats?: QuizStats } = {},
) {
  const routeId = options.routeId ?? 'biases';
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'biases/:id', component: FlashCardHomePage, data: { conceptType: 'bias' } },
      ]),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const stats = TestBed.inject(StatsService);
  const getStats = vi.spyOn(stats, 'getStats').mockReturnValue(options.stats ?? statsWith({}, 0));
  const harness = await RouterTestingHarness.create(`/biases/${routeId}`);
  http.expectOne('data/quizzes.json').flush(options.manifestFile ?? manifest);
  const knowsRoute = (options.manifestFile ?? manifest).quizzes.some((e) => e.id === routeId);
  if (knowsRoute) {
    http.expectOne('data/concepts/knowledge-base.json').flush(kb);
  } else {
    http.expectNone('data/concepts/knowledge-base.json');
  }
  harness.detectChanges();
  const el = harness.fixture.nativeElement as HTMLElement;
  return { harness, el, getStats };
}

function byTestId(el: HTMLElement, id: string): HTMLElement | null {
  return el.querySelector(`[data-testid="${id}"]`);
}

describe('FlashCardHomePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  it('C1 shows the title and description from the manifest entry', async () => {
    const { el } = await setup();

    expect(el.querySelector('h1')?.textContent).toContain('Biases');
    expect(el.textContent).toContain('Cognitive biases to drill.');
  });

  it('C2 Start round links to round and is styled as primary', async () => {
    const { el } = await setup();
    const start = byTestId(el, 'start-round');

    expect(start).not.toBeNull();
    expect(start!.getAttribute('href')).toBe('/biases/biases/round');
    expect(start!.className).toContain('bg-accent');
  });

  it('C3 shows a dash for rounds played and accuracy with empty stats', async () => {
    const { el } = await setup();

    expect(byTestId(el, 'rounds-played')?.textContent).toContain('—');
    expect(byTestId(el, 'accuracy')?.textContent).toContain('—');
  });

  it('C4 shows rounds played and accuracy after answers', async () => {
    const { el } = await setup({
      stats: statsWith({ b1: { traitId: 'b1', correct: 3, attempted: 4 } }, 2),
    });

    expect(byTestId(el, 'rounds-played')?.textContent).toContain('2');
    expect(byTestId(el, 'accuracy')?.textContent).toContain('75%');
  });

  it('C5 links to the stats page', async () => {
    const { el } = await setup();
    const link = byTestId(el, 'stats-link');

    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/biases/biases/stats');
  });

  it('C6 lists only the kind concepts with name and short definition, and no controls', async () => {
    const { el } = await setup();
    const items = Array.from(el.querySelectorAll('[data-testid="deck-item"]')).map(
      (li) => li.textContent ?? '',
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toContain('Name b1');
    expect(items[0]).toContain('short b1');
    expect(items[1]).toContain('Name b2');
    expect(items.join(' ')).not.toContain('Name f1');
    expect(el.querySelectorAll('input, select, textarea').length).toBe(0);
    expect(el.querySelectorAll('button').length).toBe(0);
  });

  it('C7 back link goes to the library at /', async () => {
    const { el } = await setup();
    const back = byTestId(el, 'back');

    expect(back).not.toBeNull();
    expect(back!.getAttribute('href')).toBe('/');
  });

  it('C8 renders the shell and back link, with an empty h1 and no start round or deck, when the manifest has no entry for the id', async () => {
    const { el } = await setup({ routeId: 'missing' });

    expect(el.querySelector('h1')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('');
    expect(byTestId(el, 'back')).not.toBeNull();
    expect(byTestId(el, 'start-round')).toBeNull();
    expect(byTestId(el, 'deck-item')).toBeNull();
  });
});
