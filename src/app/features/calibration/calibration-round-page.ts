import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { CalibrationItem, DrawnItem, PendingRound } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { CalibrationContext, loadCalibrationContext } from './calibration-context';
import { resumeOrDraw } from './pending-round';
import { CALIBRATION_RNG } from './draw';
import { BipolarScale } from './bipolar-scale';
import { BankUnavailable } from './bank-unavailable';

@Component({
  selector: 'app-calibration-round-page',
  templateUrl: './calibration-round-page.html',
  imports: [BipolarScale, BankUnavailable],
})
export class CalibrationRoundPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizData = inject(QuizDataService);
  private readonly bankService = inject(CalibrationBankService);
  private readonly history = inject(CalibrationHistoryService);
  private readonly rng = inject(CALIBRATION_RNG);

  readonly ctx = signal<CalibrationContext | null>(null);
  readonly pending = signal<PendingRound | null>(null);
  readonly index = signal(0);
  readonly loadError = signal(false);

  readonly entry = computed(() => this.ctx()?.entry ?? null);
  readonly bank = computed(() => this.ctx()?.bank ?? null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loadError.set(false);
    this.route.paramMap
      .pipe(
        map((p) => p.get('id') ?? ''),
        switchMap((id) => loadCalibrationContext(id, this.quizData, this.bankService, this.history)),
      )
      .subscribe({
        next: (c) => {
          const { pending, fresh } = resumeOrDraw(
            this.history.getPending(c.quizId),
            c.bank,
            this.history.getHistory(c.quizId).log,
            this.rng,
          );
          if (fresh) {
            this.history.savePending(c.quizId, pending);
          }
          this.ctx.set(c);
          this.pending.set(pending);
          this.index.set(0);
        },
        error: () => this.loadError.set(true),
      });
  }
}
