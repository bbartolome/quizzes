import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { CalibrationContext, loadCalibrationContext } from './calibration-context';
import { buildResultsView, ResultsView } from './results-view';
import { CalibrationChart } from './calibration-chart';
import { SkillScoreCard } from './skill-score-card';
import { ConfidenceCard } from './confidence-card';
import { ReviewList } from './review-list';
import { BankUnavailable } from './bank-unavailable';

@Component({
  selector: 'app-calibration-results-page',
  standalone: true,
  templateUrl: './calibration-results-page.html',
  imports: [CalibrationChart, SkillScoreCard, ConfidenceCard, ReviewList, BankUnavailable],
})
export class CalibrationResultsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizData = inject(QuizDataService);
  private readonly bankService = inject(CalibrationBankService);
  private readonly history = inject(CalibrationHistoryService);

  readonly ctx = signal<CalibrationContext | null>(null);
  readonly view = signal<ResultsView | null>(null);
  readonly loadError = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loadError.set(false);
    this.route.paramMap
      .pipe(
        map((p) => p.get('id') ?? ''),
        switchMap((id) =>
          loadCalibrationContext(id, this.quizData, this.bankService, this.history),
        ),
      )
      .subscribe({
        next: (c) => {
          const last = this.history.lastRound(c.quizId);
          if (!last) {
            this.router.navigate(['/calibration', c.quizId], { replaceUrl: true });
            return;
          }
          this.ctx.set(c);
          this.view.set(
            buildResultsView(c.format, c.bank, last, this.history.lifetimeBefore(c.quizId)),
          );
        },
        error: () => this.loadError.set(true),
      });
  }
}
