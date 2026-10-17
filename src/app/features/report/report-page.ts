import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, switchMap } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import {
  KnowledgeBaseEntry,
  ScoredQuestionResult,
} from '../../core/models/quiz.models';
import {
  STATUS_LABELS,
  findConfusionTips,
  optionStatus,
  summaryLine,
  type OptionStatus,
} from './report-logic';

/** Shape of the data passed to the report page through history.state. */
interface ReportHistoryState {
  results?: ScoredQuestionResult[];
  quizTitle?: string;
}

/**
 * Shows the scored results of a completed quiz round, pulled from
 * `history.state`, plus per-question confusion tips resolved against the
 * quiz's knowledge base (loaded via the "page pattern").
 *
 * The template lives in `report-page.html` (a separate step) and consumes the
 * public members below: `id`, `quizTitle`, `results`, `kb`, `hasResults`,
 * `statusLabels`, and the report-logic helpers `optionStatus`,
 * `findConfusionTips`, and `summaryLine`.
 */
@Component({
  selector: 'app-report-page',
  imports: [RouterLink],
  templateUrl: './report-page.html',
})
export class ReportPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly quizData = inject(QuizDataService);

  /** Quiz id taken from the route (e.g. "rt" for /quiz/rt). */
  readonly id = signal('');

  /** Title of the quiz, taken from history.state. */
  readonly quizTitle = signal('');

  /** The scored results for this round, taken from history.state. */
  readonly results = signal<ScoredQuestionResult[]>([]);

  /** Loaded knowledge base entries (empty until the page pattern resolves). */
  readonly kb = signal<KnowledgeBaseEntry[]>([]);

  /** Whether there is anything to report (drives the empty-state view). */
  readonly hasResults = computed(() => this.results().length > 0);

  /** Human-readable text for each option status (status -> label). */
  readonly statusLabels = STATUS_LABELS;

  // Exposed for report-page.html, which calls these directly per result/option.
  readonly optionStatus = optionStatus;
  readonly findConfusionTips = findConfusionTips;
  readonly summaryLine = summaryLine;

  ngOnInit(): void {
    const state = (window.history.state ?? {}) as ReportHistoryState;

    this.id.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.quizTitle.set(state.quizTitle ?? '');
    this.results.set(state.results ?? []);

    // Only fetch the knowledge base when there is actually a report to render;
    // the empty state should not trigger any data loading.
    if (this.hasResults()) {
      this.loadKnowledgeBase();
    }
  }

  /**
   * Page pattern: manifest -> entry for the current quiz id -> that entry's
   * bundle -> store the bundle's knowledge base for confusion-tip lookups.
   */
  private loadKnowledgeBase(): void {
    const id = this.id();

    this.quizData
      .loadManifest()
      .pipe(
        switchMap((manifest) => {
          const entry = manifest.quizzes.find((q) => q.id === id);
          return entry ? this.quizData.loadQuizBundle(entry) : EMPTY;
        }),
      )
      .subscribe({
        next: (bundle) => {
          if (bundle?.knowledgeBase) {
            this.kb.set(bundle.knowledgeBase);
          }
        },
        error: () => {
          // Leave the knowledge base empty; the template renders whatever it
          // can with the results and skips tips when kb is empty.
          this.kb.set([]);
        },
      });
  }
}
