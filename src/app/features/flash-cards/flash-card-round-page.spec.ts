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
  const fixture = TestBed.createComponent(FlashCardRoundPage);
  fixture.detectChanges();
  http.expectOne('data/quizzes.json').flush(manifest);
  http.expectOne('data/concepts/knowledge-base.json').flush(knowledgeBase);
  return { component: fixture.componentInstance, migrateVersion };
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
});
