import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, switchMap } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { Concept, QuizStats } from '../../core/models/quiz.models';
import { overallAccuracy, traitRows, type TraitRow } from './stats-rows';

/**
 * Shows cumulative per-quiz stats: rounds played, current streak, overall
 * accuracy, and a per-trait accuracy bar chart, plus controls to (a) jump to a
 * round filtered to the weakest traits and (b) reset all progress.
 *
 * Data is loaded via the shared "page pattern":
 *   loadManifest() -> entry for this quiz id -> loadQuizBundle(entry)
 * from which the knowledge base (for trait names) and the quiz title are taken.
 *
 * The template lives in `stats-page.html` (a separate step) and consumes the
 * public members below: `id`, `quizTitle`, `stats`, `kb`, `rows`,
 * `roundsPlayed`, `streak`, `totalAccuracy`, `hasRows`, `noStats`, and `reset`.
 */
@Component({
  selector: 'app-stats-page',
  imports: [RouterLink],
  templateUrl: './stats-page.html',
})
export class StatsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly quizData = inject(QuizDataService);
  private readonly statsService = inject(StatsService);

  /** Quiz id taken from the route (e.g. "rt" for /quiz/rt/stats). */
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  /** Title of the quiz, taken from the manifest entry for this id. */
  readonly quizTitle = signal('');

  /** Knowledge base entries (empty until the page pattern resolves). */
  readonly kb = signal<Concept[]>([]);

  /** Cumulative stats for this quiz, re-read after a reset. */
  readonly stats = signal<QuizStats>(this.statsService.getStats(this.id));

  /** Per-trait rows (accuracy-sorted), computed from the stats + knowledge base. */
  readonly rows = computed<TraitRow[]>(() => traitRows(this.stats(), this.kb()));

  /** Template-facing derived values. */
  readonly roundsPlayed = computed(() => this.stats().roundsPlayed);
  readonly streak = computed(() => this.stats().streak);
  readonly totalAccuracy = computed(() => overallAccuracy(this.stats()));
  readonly hasRows = computed(() => this.rows().length > 0);
  readonly noStats = computed(() => this.stats().roundsPlayed === 0);

  ngOnInit(): void {
    this.loadQuizBundle();
  }

  /**
   * Page pattern: manifest -> entry for the current quiz id -> that entry's
   * bundle. Populates `quizTitle` (from the entry) and `kb` (from the bundle).
   */
  private loadQuizBundle(): void {
    this.quizData
      .loadManifest()
      .pipe(
        switchMap((manifest) => {
          const entry = manifest.quizzes.find((q) => q.id === this.id);
          if (entry) {
            this.quizTitle.set(entry.title);
          }
          return entry ? this.quizData.loadQuizBundle(entry) : EMPTY;
        }),
      )
      .subscribe({
        next: (bundle) => {
          if (bundle?.knowledgeBase) {
            this.kb.set(bundle.knowledgeBase.concepts);
          }
        },
        error: () => {
          // Leave the knowledge base empty; rows fall back to raw trait ids.
          this.kb.set([]);
        },
      });
  }

  /** Resets all progress for this quiz after an explicit user confirmation. */
  reset(): void {
    if (confirm('Reset all progress for this quiz? This cannot be undone.')) {
      this.statsService.resetQuiz(this.id);
      this.stats.set(this.statsService.getStats(this.id));
    }
  }
}
