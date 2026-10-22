import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Concept } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';

@Component({
  selector: 'app-flash-card-round-page',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashCardRoundPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);

  /** The kind's concepts (route conceptType), in knowledge-base order. */
  readonly deck = signal<Concept[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const conceptType = this.route.snapshot.data['conceptType'] as Concept['type'];

    this.quizData.loadManifest().subscribe((manifest) => {
      const entry = manifest.quizzes.find((e) => e.id === id);
      if (!entry) {
        return;
      }
      this.quizData.loadKnowledgeBase().subscribe((kb) => {
        const deck = kb.concepts.filter((c) => c.type === conceptType);
        this.deck.set(deck);
        this.stats.migrateVersion(
          id,
          entry.version,
          deck.map((c) => c.id),
        );
      });
    });
  }
}
