import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { CalibrationContext, loadCalibrationContext } from './calibration-context';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { HomeStats, homeStats } from './home-stats';
import { CalibrationSparkline } from './calibration-sparkline';
import { BankUnavailable } from './bank-unavailable';

@Component({
  selector: 'app-calibration-home-page',
  standalone: true,
  templateUrl: './calibration-home-page.html',
  imports: [RouterLink, CalibrationSparkline, BankUnavailable],
})
export class CalibrationHomePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizData = inject(QuizDataService);
  private readonly bankService = inject(CalibrationBankService);
  private readonly history = inject(CalibrationHistoryService);

  readonly ctx = signal<CalibrationContext | null>(null);
  readonly stats = signal<HomeStats | null>(null);
  readonly loadError = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loadError.set(false);
    this.route.paramMap
      .pipe(
        map(p => p.get('id') ?? ''),
        switchMap(id =>
          loadCalibrationContext(id, this.quizData, this.bankService, this.history),
        ),
      )
      .subscribe({
        next: c => {
          this.ctx.set(c);
          this.stats.set(homeStats(this.history.getHistory(c.quizId), c.bank, c.format));
        },
        error: () => this.loadError.set(true),
      });
  }

  startOver(): void {
    const id = this.ctx()!.quizId;
    this.history.discardPending(id);
    this.router.navigate(['/calibration', id, 'round']);
  }
}
