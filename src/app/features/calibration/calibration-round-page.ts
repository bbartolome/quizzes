import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { CalibrationItem, DrawnItem, PendingRound, type FourWayChoice } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { CalibrationContext, loadCalibrationContext } from './calibration-context';
import { allItemsAnswered, isItemAnswered, resumeOrDraw, setPick } from './pending-round';
import { fourWayBankPick, fourWayScreenChoice, screenOptions, twoWayBankPick, twoWayScreenSelection } from './round-sides';
import { CALIBRATION_RNG } from './draw';
import { BipolarScale } from './bipolar-scale';
import { BankUnavailable } from './bank-unavailable';
import { FourWayControl } from './four-way-control';

@Component({
  selector: 'app-calibration-round-page',
  templateUrl: './calibration-round-page.html',
  imports: [BipolarScale, BankUnavailable, FourWayControl],
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
  readonly isFourWay = computed(() => this.ctx()?.format === 'four-way');

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

  readonly current = computed<{ drawn: DrawnItem; item: CalibrationItem } | null>(() => {
    const drawn = this.pending()?.items[this.index()];
    if (!drawn) return null;
    const item = this.bank()?.items.find((i) => i.id === drawn.itemId);
    if (!item) return null;
    return { drawn, item };
  });

  readonly onScreenOptions = computed<[string, string]>(() => {
    const c = this.current();
    return c ? screenOptions(c.item.options, c.drawn.swapped) : ['', ''];
  });

  readonly allAnswered = computed(() => {
    const p = this.pending();
    return p !== null && allItemsAnswered(p);
  });

  isAnswered(i: number): boolean {
    const p = this.pending();
    if (!p) return false;
    return isItemAnswered(p, p.items[i]?.itemId);
  }

  readonly selectedTwoWay = computed(() => {
    const c = this.current();
    if (!c) return null;
    const stored = this.pending()?.picks[c.drawn.itemId];
    if (stored && typeof stored.pick === 'number') {
      return twoWayScreenSelection(stored.pick, stored.confidence ?? 0, c.drawn.swapped);
    }
    return null;
  });

  readonly selectedFourWay = computed<{ choice?: FourWayChoice; confidence?: number }>(() => {
    const c = this.current();
    if (!c) return {};
    const stored = this.pending()?.picks[c.drawn.itemId];
    if (stored && Array.isArray(stored.pick)) {
      return { choice: fourWayScreenChoice(stored.pick, c.drawn.swapped), confidence: stored.confidence };
    }
    return {};
  });

  private record(pick: number | [boolean, boolean], confidence: number | undefined, advance: boolean): void {
    const ctx = this.ctx();
    const c = this.current();
    const old = this.pending();
    if (!ctx || !c || !old) return;
    const p = setPick(old, c.drawn.itemId, { pick, confidence });
    this.pending.set(p);
    this.history.savePending(ctx.quizId, p);
    if (advance && this.index() < p.items.length - 1) {
      this.index.update((i) => i + 1);
    }
  }

  answerTwoWay(a: { side: 0 | 1; confidence: number }): void {
    const swapped = this.current()?.drawn.swapped ?? false;
    this.record(twoWayBankPick(a.side, swapped), a.confidence, true);
  }

  answerFourWay(a: { choice: FourWayChoice; confidence: number | null }): void {
    const swapped = this.current()!.drawn.swapped;
    this.record(fourWayBankPick(a.choice, swapped), a.confidence ?? undefined, a.confidence !== null);
  }

  goTo(i: number): void {
    this.index.set(i);
  }

  back(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  submit(): void {
    if (!this.allAnswered()) return;
    const ctx = this.ctx();
    const p = this.pending();
    if (!ctx || !p) return;
    this.history.submit(ctx.quizId, ctx.bank, p);
    this.router.navigate(['/calibration', ctx.quizId, 'results']);
  }
}
