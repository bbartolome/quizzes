import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { FlashCardRoundPage } from './flash-card-round-page';
import { StatsService } from '../../core/services/stats.service';
import { Concept, KnowledgeBase, QuizManifest } from '../../core/models/quiz.models';

const manifest: QuizManifest = {
  quizzes: [
    {
      id: 'biases',
      title: 'Biases',
      description: 'desc',
      icon: 'icons/biases.svg',
      accent: '#000000',
      version: 1,
      order: 1,
      kind: 'biases',
    },
    {
      id: 'fallacies',
      title: 'Fallacies',
      description: 'desc',
      icon: 'icons/fallacies.svg',
      accent: '#000000',
      version: 1,
      order: 2,
      kind: 'fallacies',
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

const B1 = concept('b1', 'bias');
const B2 = concept('b2', 'bias');
const F1 = concept('f1', 'fallacy');

const kb: KnowledgeBase = { concepts: [B1, F1, B2], pairs: [] };

function setup(routeId: string, conceptType: Concept['type'], knowledgeBase: KnowledgeBase = kb) {
  TestBed.configureTestingModule({
    imports: [FlashCardRoundPage],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ id: routeId }),
            data: { conceptType },
          },
        },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const stats = TestBed.inject(StatsService);
  const migrateVersion = vi.spyOn(stats, 'migrateVersion');
  const getStats = vi.spyOn(stats, 'getStats');
  const fixture = TestBed.createComponent(FlashCardRoundPage);
  fixture.detectChanges();
  http.expectOne('data/quizzes.json').flush(manifest);
  http.expectOne('data/concepts/knowledge-base.json').flush(knowledgeBase);
  return { component: fixture.componentInstance, migrateVersion, getStats };
}

describe('FlashCardRoundPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  describe('deck loading (S6.1)', () => {
    it('loads the knowledge base from the fixed path and keeps only concepts of the route type', () => {
      const { component } = setup('biases', 'bias');

      expect(component.deck().map((c) => c.id)).toEqual(['b1', 'b2']);
    });

    it('the fallacies route takes only fallacy concepts', () => {
      const { component } = setup('fallacies', 'fallacy');

      expect(component.deck().map((c) => c.id)).toEqual(['f1']);
    });

    it('calls migrateVersion with the kind id, the manifest version and the deck concept ids', () => {
      const { migrateVersion } = setup('biases', 'bias');

      expect(migrateVersion).toHaveBeenCalledWith('biases', 1, ['b1', 'b2']);
    });

    it('with no concept of the route type the deck is empty', () => {
      const biasOnly: KnowledgeBase = { concepts: [B1, B2], pairs: [] };
      const { component } = setup('fallacies', 'fallacy', biasOnly);

      expect(component.deck()).toEqual([]);
    });
  });

  describe('round start (S6.2)', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('the first card target is a deck concept', () => {
      const { component } = setup('biases', 'bias');

      const deckIds = component.deck().map((c) => c.id);
      expect(component.cards()).toHaveLength(1);
      expect(deckIds).toContain(component.cards()[0].target.id);
    });

    it('the first card is built with four options and the target among them', () => {
      const fourConcepts: KnowledgeBase = {
        concepts: [B1, B2, F1, concept('f2', 'fallacy')],
        pairs: [],
      };
      const { component } = setup('biases', 'bias', fourConcepts);

      const first = component.cards()[0];
      expect(first.card.options).toHaveLength(4);
      expect(first.card.optionConcepts.map((c) => c.id)).toContain(first.target.id);
      expect(first.picked).toBeNull();
      expect(first.checked).toBe(false);
    });

    it('base weights are read once at round start from both stats keys', () => {
      const { getStats } = setup('biases', 'bias');

      const traitsReads = getStats.mock.calls.filter(([key]) => key === 'reasoning-traps');
      expect(traitsReads).toHaveLength(1);
      expect(getStats).toHaveBeenCalledWith('biases');
    });
  });
});
