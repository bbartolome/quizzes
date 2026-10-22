import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Concept, KnowledgeBase } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { FlashCard, buildCard } from './card-builder';
import { baseWeights, drawTarget } from './draw-weights';

/** One card in the feed. `picked` is the option index chosen, or null. */
export interface RoundCard {
  target: Concept;
  card: FlashCard;
  picked: number | null;
  checked: boolean;
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

  private kb: KnowledgeBase = { concepts: [], pairs: [] };
  private baseWeightMap = new Map<string, number>();
  private readonly bumpedIds = signal<ReadonlySet<string>>(new Set());

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
