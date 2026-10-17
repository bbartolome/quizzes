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
  kbByName,
  nextQuestion,
  parseRoundFilters,
  weakTraitWeights,
  type RoundFilters,
} from './round-builder';
import {
  STATUS_LABELS,
  findConfusionTips,
  optionStatus,
} from '../report/report-logic';

export interface RoundEntry {
  question: RoundQuestion;
  selected: string[];
  result?: ScoredQuestionResult;
}

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

  private quizId = '';
  private bundle!: QuizBundle;
  private filters!: RoundFilters;
  private weights?: Record<string, number>;
  private readonly usedIds = new Set<string>();
  private serial = 0;

  readonly quizTitle = signal('');
  readonly kb = signal<KnowledgeBaseEntry[]>([]);
  readonly entries = signal<RoundEntry[]>([]);
  readonly exhausted = signal(false);
  readonly openInfo = signal<string | null>(null);

  readonly score = computed(() => {
    const checked = this.entries().filter((e) => e.result !== undefined);
    return {
      correct: checked.filter((e) => e.result!.correct).length,
      answered: checked.length,
    };
  });

  private readonly kbIndex = computed(() => kbByName(this.kb()));

  readonly canCheck = computed(() => {
    const entries = this.entries();
    const last = entries[entries.length - 1];
    return !!last && last.result === undefined && last.selected.length > 0;
  });

  readonly statusLabels = STATUS_LABELS;
  readonly optionStatus = optionStatus;
  readonly findConfusionTips = findConfusionTips;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const q = this.route.snapshot.queryParamMap;
    this.quizId = id;
    this.filters = parseRoundFilters({
      cat: q.get('cat'),
      traits: q.get('traits'),
      weakTraits: q.get('weakTraits'),
    });

    this.quizData.loadManifest().subscribe((manifest) => {
      const entry = manifest.quizzes.find((e) => e.id === id) as QuizManifestEntry;
      this.quizTitle.set(entry.title);

      this.quizData.loadQuizBundle(entry).subscribe((bundle: QuizBundle) => {
        this.bundle = bundle;
        this.kb.set(bundle.knowledgeBase);
        this.weights = this.filters.weakTraits
          ? weakTraitWeights(this.stats.getWeakTraits(id))
          : undefined;
        this.stats.migrateVersion(id, entry.version, bundle.knowledgeBase.map((k: KnowledgeBaseEntry) => k.id));

        this.appendNext();
      });
    });
  }

  private appendNext(): void {
    const question = nextQuestion({
      questions: this.bundle.questions,
      templates: this.bundle.templates,
      kb: this.kb(),
      filters: this.filters,
      usedIds: this.usedIds,
      weights: this.weights,
      selectRound: (bank, options) => this.engine.selectRound(bank, options),
      renderTemplate: (tpl, traitIds) => this.templateGenerator.render(tpl, traitIds),
      serial: this.serial++,
    });

    if (question) {
      this.usedIds.add(question.id);
      this.entries.update((current) => [
        ...current,
        { question, selected: [] },
      ]);
      setTimeout(() => {
        const els = document.querySelectorAll('[data-testid="question"]');
        const lastEl = els[els.length - 1];
        lastEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      });
    } else {
      this.exhausted.set(true);
    }
  }

  infoFor(option: string): KnowledgeBaseEntry | undefined {
    return this.kbIndex().get(option.toLowerCase());
  }

  toggleInfo(index: number, option: string): void {
    const key = `${index}:${option}`;
    this.openInfo.set(this.openInfo() === key ? null : key);
  }

  toggle(index: number, option: string): void {
    const entries = this.entries();
    if (index !== entries.length - 1) {
      return;
    }
    const entry = entries[index];
    if (entry.result !== undefined) {
      return;
    }
    const selected = entry.selected.includes(option)
      ? entry.selected.filter((o) => o !== option)
      : [...entry.selected, option];
    this.entries.update((current) =>
      current.map((e, i) => (i === index ? { ...e, selected } : e)),
    );
  }

  check(): void {
    if (!this.canCheck()) {
      return;
    }
    const entries = this.entries();
    const lastIndex = entries.length - 1;
    const last = entries[lastIndex];
    const result = this.engine.score(last.question, last.selected);
    this.stats.recordResult(this.quizId, result);
    this.entries.update((current) =>
      current.map((e, i) => (i === lastIndex ? { ...e, result } : e)),
    );
    this.appendNext();
  }

  endQuiz(): void {
    const results = this.entries()
      .filter((e) => e.result !== undefined)
      .map((e) => e.result!);
    if (results.length > 0) {
      this.stats.recordSessionEnd(this.quizId);
    }
    this.router.navigate(['/quiz', this.quizId, 'report'], {
      state: { results, quizTitle: this.quizTitle() },
    });
  }
}
