import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { map, takeUntil, Subject } from 'rxjs';
import { QuizBundle, QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { KnowledgeBaseEntry, QuizManifestEntry } from '../../core/models/quiz.models';

export type CategoryFilter = 'fallacy' | 'bias' | 'both';

@Component({
  selector: 'app-quiz-home-page',
  imports: [RouterLink],
  templateUrl: './quiz-home-page.html',
})
export class QuizHomePage implements OnInit, OnDestroy {
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  private readonly destroyed = new Subject<void>();

  // --- Data-driven state ---
  protected readonly id = signal<string>('');
  protected readonly entry = signal<QuizManifestEntry | null>(null);
  protected readonly traits = signal<KnowledgeBaseEntry[]>([]);
  protected readonly hasStats = signal(false);

  // --- In-memory filter state ---
  protected category = signal<CategoryFilter>('both');
  protected traitsSelected = signal<string[]>([]);

  // --- Derived query params for navigation ---
  protected readonly roundParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (this.category() !== 'both') {
      params['cat'] = this.category();
    }
    const selected = this.traitsSelected();
    if (selected.length > 0) {
      params['traits'] = selected.join(',');
    }
    return params;
  });

  protected readonly weakRoundParams = computed<Record<string, string>>(() => ({
    ...this.roundParams(),
    weakTraits: 'true',
  }));

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        takeUntil(this.destroyed),
      )
      .subscribe((quizId) => {
        this.id.set(quizId);
        this.loadQuizData(quizId);
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  // --- Methods used by the template ---
  protected setCategory(value: CategoryFilter): void {
    this.category.set(value);
  }

  protected toggleTrait(traitId: string): void {
    const current = this.traitsSelected();
    const idx = current.indexOf(traitId);
    if (idx >= 0) {
      this.traitsSelected.set([...current.slice(0, idx), ...current.slice(idx + 1)]);
    } else {
      this.traitsSelected.set([...current, traitId]);
    }
  }

  protected clearTraits(): void {
    this.traitsSelected.set([]);
  }

  protected isTraitSelected(traitId: string): boolean {
    return this.traitsSelected().includes(traitId);
  }

  private loadQuizData(quizId: string): void {
    this.quizData
      .loadManifest()
      .pipe(takeUntil(this.destroyed))
      .subscribe((manifest) => {
        const entry = manifest.quizzes.find((q) => q.id === quizId) ?? null;
        this.entry.set(entry);
        if (entry) {
          this.quizData
            .loadQuizBundle(entry)
            .pipe(takeUntil(this.destroyed))
            .subscribe((bundle: QuizBundle) => {
              this.traits.set(bundle.knowledgeBase);
            });
        }
        const s = this.stats.getStats(quizId);
        this.hasStats.set(Object.keys(s.perTrait).length > 0);
      });
  }
}
