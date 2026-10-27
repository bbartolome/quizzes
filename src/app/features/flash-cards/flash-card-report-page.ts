import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Concept } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { BACK_LABELS, ReportResult, buildReportSummary, isReportEmpty } from './report-summary';
import { Button } from '../../shared/ui/button.directive';
import { Card } from '../../shared/ui/card.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { PageShell } from '../../shared/ui/page-shell';

@Component({
  selector: 'app-flash-card-report-page',
  imports: [Button, Card, EmptyState, PageShell],
  templateUrl: './flash-card-report-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashCardReportPage implements OnInit {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly quizData: QuizDataService = inject(QuizDataService);

  readonly conceptType = signal<Concept['type']>('bias');
  readonly results = signal<ReportResult[]>([]);
  readonly names = signal<Map<string, string>>(new Map());
  /** The quiz title from the manifest. Empty until it loads, and the h1 stays empty until then. */
  readonly quizTitle = signal('');

  readonly summary = computed(() => buildReportSummary(this.results(), this.names()));
  readonly empty = computed(() => isReportEmpty(this.results()));
  readonly backLabel = computed(() => BACK_LABELS[this.conceptType()]);
  readonly reportTitle = computed(() => (this.quizTitle() ? `${this.quizTitle()}: report` : ''));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.conceptType.set(this.route.snapshot.data['conceptType'] as Concept['type']);
    // Results are passed by the round page's End quiz in history.state; a reload loses them.
    const results: ReportResult[] =
      (window.history.state as { results?: ReportResult[] } | null)?.results ?? [];
    this.results.set(results);
    this.quizData.loadManifest().subscribe((manifest) => {
      this.quizTitle.set(manifest.quizzes.find((e) => e.id === id)?.title ?? '');
    });
    this.quizData.loadKnowledgeBase().subscribe((kb) => {
      this.names.set(new Map(kb.concepts.map((c) => [c.id, c.name])));
    });
  }

  nextRound(): void {
    this.router.navigate(['../round'], { relativeTo: this.route });
  }

  back(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }
}
