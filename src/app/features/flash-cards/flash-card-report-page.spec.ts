import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { FlashCardReportPage } from './flash-card-report-page';
import { ReportResult } from './report-summary';
import { Concept, KnowledgeBase } from '../../core/models/quiz.models';

function concept(id: string, name: string, type: Concept['type']): Concept {
  return {
    id,
    name,
    type,
    shortDefinition: `short ${id}`,
    longExplanation: `long ${id}`,
    example: `example ${id}`,
  };
}

const kb: KnowledgeBase = {
  concepts: [
    concept('anchoring', 'Anchoring', 'bias'),
    concept('availability-heuristic', 'Availability heuristic', 'bias'),
    concept('straw-man', 'Straw man', 'fallacy'),
    concept('hasty-generalization', 'Hasty generalization', 'fallacy'),
  ],
  pairs: [],
};

const mixed: ReportResult[] = [
  { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
  { targetId: 'straw-man', pickedId: 'hasty-generalization', correct: false },
  { targetId: 'availability-heuristic', pickedId: 'anchoring', correct: false },
];

interface Setup {
  fixture: ComponentFixture<FlashCardReportPage>;
  route: { snapshot: { paramMap: ReturnType<typeof convertToParamMap>; data: object } };
  navigate: ReturnType<typeof vi.fn>;
}

function setup(
  conceptType: Concept['type'],
  historyResults: ReportResult[] | undefined,
  knowledgeBase: KnowledgeBase = kb,
): Setup {
  window.history.replaceState(historyResults ? { results: historyResults } : {}, '');
  TestBed.configureTestingModule({
    imports: [FlashCardReportPage],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ id: conceptType === 'bias' ? 'biases' : 'fallacies' }),
            data: { conceptType },
          },
        },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(FlashCardReportPage);
  fixture.detectChanges();
  http.expectOne('data/concepts/knowledge-base.json').flush(knowledgeBase);
  fixture.detectChanges();
  const route = TestBed.inject(ActivatedRoute) as unknown as Setup['route'];
  return { fixture, route, navigate };
}

function text(fixture: ComponentFixture<FlashCardReportPage>, testId: string): string | null {
  return (
    (fixture.nativeElement as HTMLElement)
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent?.trim() ?? null
  );
}

function button(fixture: ComponentFixture<FlashCardReportPage>, testId: string): HTMLButtonElement {
  return (fixture.nativeElement as HTMLElement).querySelector(
    `[data-testid="${testId}"]`,
  ) as HTMLButtonElement;
}

describe('FlashCardReportPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    window.history.replaceState({}, '');
    vi.restoreAllMocks();
  });

  describe('summary (S7.2)', () => {
    it('renders "N of M correct" from the round results', () => {
      const { fixture } = setup('bias', mixed);

      expect(text(fixture, 'summary')).toBe('1 of 3 correct');
    });

    it('renders one missed line per wrong card with resolved names', () => {
      const { fixture } = setup('bias', mixed);

      const lines = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="missed-line"]'),
      ).map((el) => el.textContent?.trim());
      expect(lines).toEqual([
        'Straw man — you picked Hasty generalization',
        'Availability heuristic — you picked Anchoring',
      ]);
    });

    it('shows the "No misses" note for a perfect round', () => {
      const perfect: ReportResult[] = [
        { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
      ];
      const { fixture } = setup('bias', perfect);

      expect(text(fixture, 'no-misses')).toBe('No misses this round.');
      expect(fixture.nativeElement.querySelector('[data-testid="missed-line"]')).toBeNull();
    });

    it('does not show the "No misses" note when there are misses', () => {
      const { fixture } = setup('bias', mixed);

      expect(fixture.nativeElement.querySelector('[data-testid="no-misses"]')).toBeNull();
    });

    it('reads the round results from window.history.state', () => {
      const perfect: ReportResult[] = [
        { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
        { targetId: 'anchoring', pickedId: 'anchoring', correct: true },
      ];
      const { fixture } = setup('bias', perfect);

      expect(text(fixture, 'summary')).toBe('2 of 2 correct');
    });
  });

  describe('empty state (S7.2)', () => {
    it('with no results, shows a short message and a back link, and no summary or missed list', () => {
      const { fixture } = setup('bias', undefined);

      expect(text(fixture, 'empty')).not.toBeNull();
      expect(button(fixture, 'back')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="summary"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="missed-list"]')).toBeNull();
    });

    it('with no results, the back link goes to the home page', () => {
      const { fixture, route, navigate } = setup('fallacy', []);

      button(fixture, 'back').click();

      expect(navigate).toHaveBeenCalledWith(['..'], { relativeTo: route });
    });
  });

  describe('actions (S7.2)', () => {
    it('Next round navigates to the round page relative to the route', () => {
      const { fixture, route, navigate } = setup('bias', mixed);

      button(fixture, 'next-round').click();

      expect(navigate).toHaveBeenCalledWith(['../round'], { relativeTo: route });
    });

    it('the back action navigates to the home page relative to the route', () => {
      const { fixture, route, navigate } = setup('bias', mixed);

      button(fixture, 'back').click();

      expect(navigate).toHaveBeenCalledWith(['..'], { relativeTo: route });
    });

    it('labels the back action "Back to Biases" for the bias route', () => {
      const { fixture } = setup('bias', mixed);

      expect(button(fixture, 'back').textContent?.trim()).toBe('Back to Biases');
    });

    it('labels the back action "Back to Fallacies" for the fallacy route', () => {
      const { fixture } = setup('fallacy', mixed);

      expect(button(fixture, 'back').textContent?.trim()).toBe('Back to Fallacies');
    });
  });
});
