import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Concept, KnowledgeBase, ScoredQuestionResult } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { FlashCard, buildCard } from './card-builder';
import { applyBump, baseWeights, drawTarget } from './draw-weights';
import { Feedback, buildFeedback } from './feedback';

/** One card in the feed. `picked` is the option index chosen, or null. */
export interface RoundCard {
  target: Concept;
  card: FlashCard;
  picked: number | null;
  checked: boolean;
  feedback?: Feedback;
}

@Component({
  selector: 'app-flash-card-round-page',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashCardRoundPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);

  private kindId = '';
  private kb: KnowledgeBase = { concepts: [], pairs: [] };
  private baseWeightMap = new Map<string, number>();
  /** Confused partners picked wrongly this round; they weigh one more in the draw, capped at 3. */
  readonly bumpedIds = signal<ReadonlySet<string>>(new Set());

  /** The kind's concepts (route conceptType), in knowledge-base order. */
  readonly deck = signal<Concept[]>([]);
  readonly cards = signal<RoundCard[]>([]);

  readonly score = computed(() => {
    const checked = this.cards().filter((c) => c.checked);
    return {
      correct: checked.filter(
        (c) => c.picked !== null && c.card.optionConcepts[c.picked].id === c.target.id,
      ).length,
      checked: checked.length,
    };
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.kindId = id;
    const conceptType = this.route.snapshot.data['conceptType'] as Concept['type'];

    this.quizData.loadManifest().subscribe((manifest) => {
      const entry = manifest.quizzes.find((e) => e.id === id);
      if (!entry) {
        return;
      }
      this.quizData.loadKnowledgeBase().subscribe((kb) => {
        this.kb = kb;
        const deck = kb.concepts.filter((c) => c.type === conceptType);
        this.deck.set(deck);
        this.stats.migrateVersion(
          id,
          entry.version,
          deck.map((c) => c.id),
        );
        this.baseWeightMap = baseWeights(
          deck,
          this.stats.getStats('reasoning-traps'),
          this.stats.getStats(id),
        );
        this.appendCard();
      });
    });
  }

  /** Records the option picked on the newest card. Ignored once that card is checked. */
  selectOption(index: number): void {
    const last = this.cards().at(-1);
    if (!last || last.checked) {
      return;
    }
    this.cards.update((current) =>
      current.map((c, i) => (i === current.length - 1 ? { ...c, picked: index } : c)),
    );
  }

  /** Locks the newest card, shows its feedback and appends the next card. Does nothing without a pick. */
  checkAnswer(): void {
    const last = this.cards().at(-1);
    if (!last || last.checked || last.picked === null) {
      return;
    }
    const pickedConcept = last.card.optionConcepts[last.picked];
    const feedback = buildFeedback(
      last.target,
      pickedConcept.id === last.target.id ? null : pickedConcept,
      last.card.optionConcepts,
      this.kb,
    );
    const correct = pickedConcept.id === last.target.id;
    const result: ScoredQuestionResult = {
      question: {
        id: last.target.id,
        prompt: last.card.prompt,
        options: last.card.options,
        correctAnswers: [last.card.options[last.card.correctIndex]],
        traitIds: [last.target.id],
        explanation: last.target.longExplanation,
      },
      selected: [pickedConcept.id],
      correct,
      missed: correct ? [] : [last.target.id],
      extra: correct ? [] : [pickedConcept.id],
    };
    this.stats.recordResult(this.kindId, result);
    if (pickedConcept.id !== last.target.id) {
      this.bumpedIds.update((ids) => applyBump(ids, last.target, pickedConcept, this.kb));
    }
    this.cards.update((current) =>
      current.map((c, i) => (i === current.length - 1 ? { ...c, checked: true, feedback } : c)),
    );
    this.appendCard();
  }

  private appendCard(): void {
    const deck = this.deck();
    if (deck.length === 0) {
      return;
    }
    const previous = this.cards().at(-1)?.target ?? null;
    const target = drawTarget(deck, previous, this.baseWeightMap, this.bumpedIds(), Math.random);
    const card = buildCard(target, this.kb, Math.random);
    this.cards.update((current) => [...current, { target, card, picked: null, checked: false }]);
  }
}
