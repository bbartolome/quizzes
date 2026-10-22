import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
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
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, migrateVersion, getStats };
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

  describe('check answer (S6.3)', () => {
    const fourConcepts: KnowledgeBase = {
      concepts: [B1, B2, F1, concept('f2', 'fallacy')],
      pairs: [],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    /** Index of an option that is the target, or of one that is not. */
    function indexOf(
      card: { target: Concept; card: { optionConcepts: Concept[] } },
      right: boolean,
    ) {
      return card.card.optionConcepts.findIndex((c) => (c.id === card.target.id) === right);
    }

    it('with no option picked, checkAnswer does nothing', () => {
      const { component } = setup('biases', 'bias', fourConcepts);

      component.checkAnswer();

      expect(component.cards()).toHaveLength(1);
      expect(component.cards()[0].checked).toBe(false);
      expect(component.cards()[0].feedback).toBeUndefined();
    });

    it('after a wrong pick, checkAnswer locks the card, shows feedback and appends one card', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const first = component.cards()[0];

      component.selectOption(indexOf(first, false));
      component.checkAnswer();

      expect(component.cards()).toHaveLength(2);
      expect(component.cards()[0].checked).toBe(true);
      expect(component.cards()[0].feedback?.verdict).toBe('Incorrect');
      expect(component.score()).toEqual({ correct: 0, checked: 1 });
    });

    it('after the target is picked, the score counts it as correct', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const first = component.cards()[0];

      component.selectOption(indexOf(first, true));
      component.checkAnswer();

      expect(component.cards()[0].feedback?.verdict).toBe('Correct');
      expect(component.score()).toEqual({ correct: 1, checked: 1 });
    });

    it('a checked card is not changed by later picks', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const first = component.cards()[0];

      component.selectOption(indexOf(first, true));
      component.checkAnswer();
      const lockedFeedback = component.cards()[0].feedback;
      component.selectOption(indexOf(first, false));
      component.checkAnswer();

      expect(component.cards()[0].picked).toBe(indexOf(first, true));
      expect(component.cards()[0].checked).toBe(true);
      expect(component.cards()[0].feedback).toBe(lockedFeedback);
    });

    it('the next target is never the target just checked (deck of two)', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const first = component.cards()[0];

      component.selectOption(indexOf(first, true));
      component.checkAnswer();

      expect(component.cards()[1].target.id).not.toBe(first.target.id);
    });

    it('base weights are not recomputed after a card is checked', () => {
      const { component, getStats } = setup('biases', 'bias', fourConcepts);
      const first = component.cards()[0];

      component.selectOption(indexOf(first, true));
      component.checkAnswer();

      const traitsReads = getStats.mock.calls.filter(([key]) => key === 'reasoning-traps');
      expect(traitsReads).toHaveLength(1);
    });
  });

  describe('in-round pair bump (S6.4)', () => {
    const withPair: KnowledgeBase = {
      concepts: [B1, B2, concept('b3', 'bias'), F1, concept('f2', 'fallacy')],
      pairs: [{ concepts: ['b1', 'b2'], tip: 'pair tip' }],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.62);
    });

    function partnerIdOf(targetId: string): string {
      return targetId === 'b1' ? 'b2' : 'b1';
    }

    it('a wrong pick that is a confused partner of the target adds the picked id to bumpedIds', () => {
      const { component } = setup('biases', 'bias', withPair);
      const first = component.cards()[0];
      const partnerId = partnerIdOf(first.target.id);

      component.selectOption(first.card.optionConcepts.findIndex((c) => c.id === partnerId));
      component.checkAnswer();

      expect(component.bumpedIds().has(partnerId)).toBe(true);
    });

    it('a wrong pick that is not a confused partner does not change bumpedIds', () => {
      const { component } = setup('biases', 'bias', withPair);
      const first = component.cards()[0];
      const partnerId = partnerIdOf(first.target.id);
      const other = first.card.optionConcepts.findIndex(
        (c) => c.id !== first.target.id && c.id !== partnerId,
      );

      component.selectOption(other);
      component.checkAnswer();

      expect(component.bumpedIds().size).toBe(0);
    });

    /** b1 has base weight 2.5 from stored history (1 attempt, 0 correct). b2 and b3 have 2 each. */
    function storeB1History(): void {
      localStorage.setItem(
        'stats:biases',
        JSON.stringify({
          quizId: 'biases',
          version: 1,
          perTrait: { b1: { traitId: 'b1', correct: 0, attempted: 1 } },
          streak: 0,
          roundsPlayed: 0,
        }),
      );
    }

    it('after b1 is bumped, a draw that favours b1 takes it as the next target', () => {
      // First draw: weights 2.5 / 2 / 2 put r = 0.58 on b2. Next draw without the bump: 2.5 / 2 gives b3.
      // With the bump: 3 / 2 gives b1.
      vi.spyOn(Math, 'random').mockReturnValue(0.58);
      storeB1History();
      const { component } = setup('biases', 'bias', withPair);
      const first = component.cards()[0];
      expect(first.target.id).toBe('b2');

      component.selectOption(first.card.optionConcepts.findIndex((c) => c.id === 'b1'));
      component.checkAnswer();

      expect(component.cards()[1].target.id).toBe('b1');
    });

    it('the bumped weight is capped at 3 in the next draw', () => {
      // Uncapped, b1 would weigh 3.5 against 2, and r = 0.62 would still land on b1.
      // Capped at 3, it weighs 3 against 2, and r = 0.62 lands on b3.
      vi.spyOn(Math, 'random').mockReturnValue(0.62);
      storeB1History();
      const { component } = setup('biases', 'bias', withPair);
      const first = component.cards()[0];
      expect(first.target.id).toBe('b2');

      component.selectOption(first.card.optionConcepts.findIndex((c) => c.id === 'b1'));
      component.checkAnswer();

      expect(component.cards()[1].target.id).toBe('b3');
    });
  });

  describe('per-card recording (S6.5)', () => {
    const fourConcepts: KnowledgeBase = {
      concepts: [B1, B2, F1, concept('f2', 'fallacy')],
      pairs: [],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    function indexOf(
      card: { target: Concept; card: { optionConcepts: Concept[] } },
      right: boolean,
    ) {
      return card.card.optionConcepts.findIndex((c) => (c.id === card.target.id) === right);
    }

    it('each checked card calls recordResult with the kind id and the target as the only trait', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const recordResult = vi.spyOn(TestBed.inject(StatsService), 'recordResult');
      const first = component.cards()[0];

      component.selectOption(indexOf(first, false));
      component.checkAnswer();

      expect(recordResult).toHaveBeenCalledTimes(1);
      const [quizId, result] = recordResult.mock.calls[0];
      expect(quizId).toBe('biases');
      expect(result.question.traitIds).toEqual([first.target.id]);
      expect(result.correct).toBe(false);
      expect(result.selected).toEqual([first.card.optionConcepts[indexOf(first, false)].id]);
    });

    it('a correct pick records correct = true', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const recordResult = vi.spyOn(TestBed.inject(StatsService), 'recordResult');
      const first = component.cards()[0];

      component.selectOption(indexOf(first, true));
      component.checkAnswer();

      const [, result] = recordResult.mock.calls[0];
      expect(result.correct).toBe(true);
      expect(result.selected).toEqual([first.target.id]);
    });

    it('two checked cards produce exactly two calls', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const recordResult = vi.spyOn(TestBed.inject(StatsService), 'recordResult');

      component.selectOption(indexOf(component.cards()[0], true));
      component.checkAnswer();
      component.selectOption(indexOf(component.cards()[1], true));
      component.checkAnswer();

      expect(recordResult).toHaveBeenCalledTimes(2);
    });

    it('lures get no counts: no trait other than the target appears in any recorded result', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const recordResult = vi.spyOn(TestBed.inject(StatsService), 'recordResult');
      const first = component.cards()[0];

      component.selectOption(indexOf(first, false));
      component.checkAnswer();

      const [, result] = recordResult.mock.calls[0];
      expect(result.question.traitIds.filter((id: string) => id !== first.target.id)).toEqual([]);
    });
  });

  describe('end quiz (S6.6)', () => {
    const fourConcepts: KnowledgeBase = {
      concepts: [B1, B2, F1, concept('f2', 'fallacy')],
      pairs: [],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    function indexOf(
      card: { target: Concept; card: { optionConcepts: Concept[] } },
      right: boolean,
    ) {
      return card.card.optionConcepts.findIndex((c) => (c.id === card.target.id) === right);
    }

    function spies(component: FlashCardRoundPage) {
      const stats = TestBed.inject(StatsService);
      const router = TestBed.inject(Router);
      return {
        recordSessionEnd: vi.spyOn(stats, 'recordSessionEnd'),
        navigate: vi.spyOn(router, 'navigate').mockResolvedValue(true),
        component,
      };
    }

    it('with a checked card, endQuiz calls recordSessionEnd once and navigates to the report', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const { recordSessionEnd, navigate } = spies(component);

      component.selectOption(indexOf(component.cards()[0], true));
      component.checkAnswer();
      component.endQuiz();

      expect(recordSessionEnd).toHaveBeenCalledTimes(1);
      expect(recordSessionEnd).toHaveBeenCalledWith('biases');
      expect(navigate.mock.calls[0][0]).toEqual(['../report']);
    });

    it('with zero checked cards, recordSessionEnd is not called and navigation still happens with empty results', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const { recordSessionEnd, navigate } = spies(component);

      component.endQuiz();

      expect(recordSessionEnd).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0][1]?.state).toEqual({ results: [] });
    });

    it('history state carries one result per checked card, in order: target, picked concept, correct', () => {
      const { component } = setup('biases', 'bias', fourConcepts);
      const { navigate } = spies(component);
      const first = component.cards()[0];

      component.selectOption(indexOf(first, false));
      component.checkAnswer();
      const second = component.cards()[1];
      component.selectOption(indexOf(second, true));
      component.checkAnswer();
      component.endQuiz();

      const pickedFirst = first.card.optionConcepts[indexOf(first, false)].id;
      expect(navigate.mock.calls[0][1]?.state).toEqual({
        results: [
          { targetId: first.target.id, pickedId: pickedFirst, correct: false },
          { targetId: second.target.id, pickedId: second.target.id, correct: true },
        ],
      });
    });
  });

  describe('feed template (S6.7)', () => {
    const fourConcepts: KnowledgeBase = {
      concepts: [B1, B2, F1, concept('f2', 'fallacy')],
      pairs: [],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    function fieldsetsOf(fixture: { nativeElement: HTMLElement }): HTMLElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('fieldset'));
    }

    it('renders one fieldset per card, in draw order', () => {
      const { component, fixture } = setup('biases', 'bias', fourConcepts);
      expect(fieldsetsOf(fixture)).toHaveLength(1);

      component.selectOption(0);
      component.checkAnswer();
      fixture.detectChanges();

      const fieldsets = fieldsetsOf(fixture);
      expect(fieldsets).toHaveLength(2);
      component.cards().forEach((card, i) => {
        expect(fieldsets[i].textContent).toContain(card.card.legend);
      });
    });

    it('scrolls the newest fieldset into view after a new card is appended', async () => {
      const scrolled: Element[] = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function () {
        scrolled.push(this as Element);
      };
      try {
        const { component, fixture } = setup('biases', 'bias', fourConcepts);
        component.selectOption(0);
        component.checkAnswer();
        fixture.detectChanges();
        await fixture.whenStable();

        const fieldsets = fieldsetsOf(fixture);
        expect(fieldsets).toHaveLength(2);
        expect(scrolled.at(-1)).toBe(fieldsets[1]);
      } finally {
        Element.prototype.scrollIntoView = original;
      }
    });
  });

  describe('check answer button (S6.8)', () => {
    const fourConcepts: KnowledgeBase = {
      concepts: [B1, B2, F1, concept('f2', 'fallacy')],
      pairs: [],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    function checkButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement | null {
      return fixture.nativeElement.querySelector('[data-testid="check-answer"]');
    }

    function clickOption(
      fixture: { nativeElement: HTMLElement; detectChanges: () => void },
      index: number,
    ) {
      const radios = fixture.nativeElement.querySelectorAll(
        'fieldset:last-of-type input[type="radio"]',
      );
      (radios[index] as HTMLInputElement).click();
      fixture.detectChanges();
    }

    it('with no option selected, Check answer is disabled', () => {
      const { fixture } = setup('biases', 'bias', fourConcepts);

      expect(checkButton(fixture)?.disabled).toBe(true);
    });

    it('with an option selected, Check answer is enabled', () => {
      const { fixture } = setup('biases', 'bias', fourConcepts);

      clickOption(fixture, 0);

      expect(checkButton(fixture)?.disabled).toBe(false);
    });

    it('after the card is locked, Check answer is disabled until the next option is picked', () => {
      const { fixture } = setup('biases', 'bias', fourConcepts);

      clickOption(fixture, 0);
      checkButton(fixture)!.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('fieldset')).toHaveLength(2);
      expect(checkButton(fixture)?.disabled).toBe(true);
    });

    it('clicking an enabled Check answer checks the card and appends the next one', () => {
      const { component, fixture } = setup('biases', 'bias', fourConcepts);

      clickOption(fixture, 1);
      checkButton(fixture)!.click();
      fixture.detectChanges();

      expect(component.cards()[0].checked).toBe(true);
      expect(component.cards()).toHaveLength(2);
    });
  });

  describe('feedback block (S6.9)', () => {
    const tipped: KnowledgeBase = {
      concepts: [
        { ...B1, spottingTip: 'spot-b1' },
        { ...B2, spottingTip: 'spot-b2' },
        F1,
        concept('f2', 'fallacy'),
      ],
      pairs: [{ concepts: ['b1', 'b2'], tip: 'pair-tip' }],
    };

    beforeEach(() => {
      // r = 0.5 draws b2 as the first target (weights 2 / 2), and b1 is its confused partner.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    function indexOf(
      card: { target: Concept; card: { optionConcepts: Concept[] } },
      right: boolean,
    ) {
      return card.card.optionConcepts.findIndex((c) => (c.id === card.target.id) === right);
    }

    function cardEl(fixture: { nativeElement: HTMLElement }, i: number): HTMLElement {
      return fixture.nativeElement.querySelectorAll('[data-testid="card"]')[i] as HTMLElement;
    }

    function labelsOf(fixture: { nativeElement: HTMLElement }, i: number): string[] {
      return Array.from(cardEl(fixture, i).querySelectorAll('label')).map(
        (l) => l.textContent ?? '',
      );
    }

    it('a correct pick shows Correct, the answer, the long explanation, the spotting tip, then the contrast', () => {
      const { component, fixture } = setup('biases', 'bias', tipped);
      const first = component.cards()[0];
      component.selectOption(indexOf(first, true));
      component.checkAnswer();
      fixture.detectChanges();

      const text = cardEl(fixture, 0).querySelector('[data-testid="feedback"]')?.textContent ?? '';
      const order = ['Correct', 'Answer: Name b2', 'long b2', 'spot-b2', 'pair-tip'].map((t) =>
        text.indexOf(t),
      );
      expect(order.every((i) => i >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('a wrong pick shows Incorrect in the same order, with the pair contrast', () => {
      const { component, fixture } = setup('biases', 'bias', tipped);
      const first = component.cards()[0];
      component.selectOption(first.card.optionConcepts.findIndex((c) => c.id === 'b1'));
      component.checkAnswer();
      fixture.detectChanges();

      const text = cardEl(fixture, 0).querySelector('[data-testid="feedback"]')?.textContent ?? '';
      const order = [
        'Incorrect',
        'Answer: Name b2',
        'long b2',
        'spot-b2',
        'Name b2 vs Name b1: pair-tip',
      ].map((t) => text.indexOf(t));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('on a wrong pick the picked option is labelled Your pick and the target Correct answer', () => {
      const { component, fixture } = setup('biases', 'bias', tipped);
      const first = component.cards()[0];
      const pickedIndex = first.card.optionConcepts.findIndex((c) => c.id === 'b1');
      component.selectOption(pickedIndex);
      component.checkAnswer();
      fixture.detectChanges();

      const labels = labelsOf(fixture, 0);
      expect(labels[pickedIndex]).toContain('Your pick');
      expect(labels[first.card.correctIndex]).toContain('Correct answer');
      expect(labels.filter((l) => l.includes('Your pick'))).toHaveLength(1);
    });

    it('on a correct pick the target is labelled Correct answer and no option is Your pick', () => {
      const { component, fixture } = setup('biases', 'bias', tipped);
      const first = component.cards()[0];
      component.selectOption(indexOf(first, true));
      component.checkAnswer();
      fixture.detectChanges();

      const labels = labelsOf(fixture, 0);
      expect(labels[first.card.correctIndex]).toContain('Correct answer');
      expect(labels.some((l) => l.includes('Your pick'))).toBe(false);
    });
  });

  describe('sticky footer (S6.10)', () => {
    const fourConcepts: KnowledgeBase = {
      concepts: [B1, B2, F1, concept('f2', 'fallacy')],
      pairs: [],
    };

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    function footer(fixture: { nativeElement: HTMLElement }): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="footer"]') as HTMLElement;
    }

    function endButton(fixture: { nativeElement: HTMLElement }): HTMLButtonElement {
      return fixture.nativeElement.querySelector('[data-testid="end-quiz"]') as HTMLButtonElement;
    }

    it('with no card checked the footer reads "0 of 0 correct" and End quiz is enabled', () => {
      const { fixture } = setup('biases', 'bias', fourConcepts);

      expect(footer(fixture).textContent).toContain('0 of 0 correct');
      expect(endButton(fixture).disabled).toBe(false);
    });

    it('with two correct out of three checked, the footer reads "2 of 3 correct"', () => {
      const { component, fixture } = setup('biases', 'bias', fourConcepts);
      const outcomes = [true, false, true];
      outcomes.forEach((right, i) => {
        const card = component.cards()[i];
        component.selectOption(
          card.card.optionConcepts.findIndex((c) => (c.id === card.target.id) === right),
        );
        component.checkAnswer();
      });
      fixture.detectChanges();

      expect(footer(fixture).textContent).toContain('2 of 3 correct');
    });

    it('the footer is sticky', () => {
      const { fixture } = setup('biases', 'bias', fourConcepts);

      const classes = footer(fixture).classList;
      expect(classes.contains('sticky') || classes.contains('fixed')).toBe(true);
    });

    it('clicking End quiz calls endQuiz', () => {
      const { component, fixture } = setup('biases', 'bias', fourConcepts);
      const endQuiz = vi.spyOn(component, 'endQuiz').mockImplementation(() => undefined);
      fixture.detectChanges();

      endButton(fixture).click();

      expect(endQuiz).toHaveBeenCalledTimes(1);
    });
  });
});
