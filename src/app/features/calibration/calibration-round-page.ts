import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { CalibrationBank, CalibrationItem, DrawnItem, PendingRound } from './calibration.models';
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

  readonly current = computed<{ drawn: DrawnItem; item: CalibrationItem } | null>(() => {
    const p = this.pending();
    const bank = this.bank();
    if (p === null || bank === null) return null;
    const drawn = p.items[this.index()];
    if (drawn === undefined) return null;
    const item = bank.items.find((b) => b.id === drawn.itemId);
    if (item === undefined) return null;
    return { drawn, item };
  });

  readonly onScreenOptions = computed<[string, string] | null>(() => {
    const c = this.current();
    if (c === null) return null;
    return c.drawn.swapped
      ? [c.item.options[1], c.item.options[0]]
      : [c.item.options[0], c.item.options[1]];
  });

  isAnswered(i: number): boolean {
    const p = this.pending();
    if (p === null) return false;
    const drawn = p.items[i];
    if (drawn === undefined) return false;
    const pick = p.picks[drawn.itemId];
    return pick !== undefined && pick.pick !== undefined && pick.confidence !== undefined;
  }

  readonly allAnswered = computed<boolean>(() => {
    const p = this.pending();
    if (p === null) return false;
    return p.items.every((d) => {
      const pick = p.picks[d.itemId];
      return pick !== undefined && pick.pick !== undefined && pick.confidence !== undefined;
    });
  });

  readonly selectedTwoWay = computed<{ side: 0 | 1; confidence: number } | null>(() => {
    const c = this.current();
    const p = this.pending();
    if (c === null || p === null) return null;
    const pick = p.picks[c.drawn.itemId];
    if (pick === undefined || pick.pick === undefined || pick.confidence === undefined) return null;
    if (typeof pick.pick !== 'number') return null;
    const side: 0 | 1 =
      pick.confidence === 50 ? 0 : (c.drawn.swapped ? (1 - pick.pick) as 0 | 1 : pick.pick as 0 | 1);
    return { side, confidence: pick.confidence };
  });

  openItem(i: number): void {
    this.index.set(i);
  }

  back(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  answer({ side, confidence }: { side: 0 | 1; confidence: number }): void {
    const c = this.current();
    const p = this.pending();
    if (c === null || p === null) return;
    const pick: 0 | 1 = c.drawn.swapped ? (1 - side) as 0 | 1 : side;
    const next: PendingRound = {
      ...p,
      picks: { ...p.picks, [c.drawn.itemId]: { pick, confidence } },
    };
    this.history.savePending(this.quizId(), next);
    this.pending.set(next);
    this.index.set(Math.min(this.index() + 1, next.items.length - 1));
  }

  submitRound(): void {
    const bank = this.bank();
    const p = this.pending();
    if (bank === null || p === null || !this.allAnswered()) return;
    this.history.submit(this.quizId(), bank, p);
    this.pending.set(null);
    void this.router.navigate(['/calibration', this.quizId(), 'results']);
  }
}
