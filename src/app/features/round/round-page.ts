import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  KnowledgeBaseEntry,
  QuizManifestEntry,
  RoundQuestion,
  ScoredQuestionResult,
} from '../../core/models/quiz.models';
import { QuizBundle, QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { QuizEngineService } from '../../core/services/quiz-engine.service';
import { TemplateGeneratorService } from '../../core/services/template-generator.service';
import {
  parseRoundFilters,
  pickTemplate,
  weakTraitWeights,
  shuffle,
} from './round-builder';

/**
 * Module-level set of question ids already used in previously built rounds,
 * so `selectRound` can avoid re-serving the same fixed questions.
 */
const USED_IDS = new Set<string>();

@Component({
  selector: 'app-round-page',
  templateUrl: './round-page.html',
})
export class RoundPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);
  private readonly engine: QuizEngineService = inject(QuizEngineService);
  private readonly templateGenerator: TemplateGeneratorService = inject(TemplateGeneratorService);

  readonly quizTitle = signal('');
  readonly questions = signal<RoundQuestion[]>([]);
  readonly selections = signal<Record<string, string[]>>({});
  readonly canSubmit = computed(() =>
    this.questions().length > 0 &&
    this.questions().every((q) => (this.selections()[q.id] ?? []).length > 0),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const q = this.route.snapshot.queryParamMap;
    const filters = parseRoundFilters({
      cat: q.get('cat'),
      traits: q.get('traits'),
      weakTraits: q.get('weakTraits'),
    });

    this.quizData.loadManifest().subscribe((manifest) => {
        const entry = manifest.quizzes.find((e) => e.id === id) as QuizManifestEntry;
        this.quizTitle.set(entry.title);

        this.quizData.loadQuizBundle(entry).subscribe((bundle: QuizBundle) => {
          const kb = bundle.knowledgeBase;
          this.stats.migrateVersion(id, entry.version, kb.map((k: KnowledgeBaseEntry) => k.id));

          const tpl = pickTemplate(bundle.templates, kb, filters);

          const fixed = this.engine.selectRound(
            { questions: bundle.questions },
            {
              count: tpl ? 3 : 4,
              categories: filters.categories,
              traitIds: filters.traitIds,
              avoidIds: USED_IDS,
              weakTraitWeights: filters.weakTraits
                ? weakTraitWeights(this.stats.getWeakTraits(id))
                : undefined,
            },
          );

          let generated: RoundQuestion[] = [];
          if (tpl) {
            generated = [this.templateGenerator.render(tpl)];
          }
          const questions = shuffle([...fixed, ...generated]);

          for (const question of questions) {
            USED_IDS.add(question.id);
          }

          this.questions.set(questions);
        });
      });
  }

  toggle(qid: string, option: string): void {
    const current = this.selections()[qid] ?? [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    this.selections.set({ ...this.selections(), [qid]: next });
  }

  submit(): void {
    const questions = this.questions();
    const results: ScoredQuestionResult[] = questions.map((q) =>
      this.engine.score(q, this.selections()[q.id] ?? []),
    );

    const id = this.route.snapshot.paramMap.get('id') ?? '';
    for (const result of results) {
      this.stats.recordResult(id, result);
    }

    this.router.navigate(['/quiz', id, 'report'], {
      state: { results, quizTitle: this.quizTitle() },
    });
  }
}
