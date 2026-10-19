import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { CalibrationBank, CalibrationItem, PendingRound } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { CALIBRATION_RNG, drawRound } from './draw';
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

  readonly quizId = signal('');
  readonly entry = signal<QuizManifestEntry | null>(null);
  readonly bank = signal<CalibrationBank | null>(null);
  readonly pending = signal<PendingRound | null>(null);
  readonly index = signal(0);
  readonly loadError = signal(false);

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    this.loadError.set(false);
    try {
      const id = (await firstValueFrom(this.route.paramMap)).get('id') ?? '';
      const manifest = await firstValueFrom(this.quizData.loadManifest());
      const entry = manifest.quizzes.find((q) => q.id === id);
      if (entry === undefined) {
        throw new Error(`No quiz manifest entry for ${id}`);
      }
      const bank = await firstValueFrom(this.bankService.loadBank(entry));
      this.history.migrate(id, bank, entry.version);
      let p = this.history.getPending(id);
      if (p === null || p.bankVersion !== bank.version) {
        p = { bankVersion: bank.version, items: drawRound(bank, this.history.getHistory(id).log, this.rng), picks: {} };
        this.history.savePending(id, p);
      }
      this.quizId.set(id);
      this.entry.set(entry);
      this.bank.set(bank);
      this.pending.set(p);
      this.index.set(0);
    } catch {
      this.loadError.set(true);
    }
  }
}
