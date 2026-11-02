import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { PracticeService } from '../../core/services/practice.service';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { CalibrationBankService } from '../calibration/calibration-bank.service';
import { CalibrationHistoryService } from '../calibration/calibration-history.service';
import { Button } from '../../shared/ui/button.directive';
import { Card } from '../../shared/ui/card.directive';
import { PageShell } from '../../shared/ui/page-shell';
import { LibraryCard } from './library-card';
import { QuizCard, calibrationCard, formatPercent, routeFor, statsCard } from './library-cards';
import { CollectionSummary, summarize } from './library-summary';

const RESET_ALL_MESSAGE = 'Reset all quiz progress across every collection? This cannot be undone.';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, AsyncPipe, Button, Card, PageShell, LibraryCard],
  templateUrl: './library-page.html',
})
export class LibraryPage {
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);
  private readonly calibration: CalibrationHistoryService = inject(CalibrationHistoryService);
  private readonly bankService: CalibrationBankService = inject(CalibrationBankService);
  private readonly practice: PracticeService = inject(PracticeService);

  protected readonly cards$: Observable<QuizCard[]> = this.quizData.loadManifest().pipe(
    switchMap((manifest) => {
      const loads = manifest.quizzes
        .filter(
          (e) =>
            e.kind === 'calibration' && this.calibration.getHistory(e.id).bankVersion !== e.version,
        )
        .map((e) =>
          this.bankService.loadBank(e).pipe(
            map((bank) => this.calibration.migrate(e.id, bank, e.version)),
            catchError(() => of(null)),
          ),
        );
      return (loads.length ? forkJoin(loads) : of([])).pipe(map(() => manifest));
    }),
    map((manifest) =>
      [...manifest.quizzes]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((entry) => this.toCard(entry)),
    ),
    shareReplay(1),
  );

  protected readonly summary$: Observable<CollectionSummary> = this.cards$.pipe(
    map((cards) => summarize(cards, this.practice.lastPlayed())),
  );

  protected readonly routeFor = routeFor;
  protected readonly formatPercent = formatPercent;

  protected resetAll(): void {
    if (confirm(RESET_ALL_MESSAGE)) {
      this.stats.resetAll();
    }
  }

  private toCard(entry: QuizManifestEntry): QuizCard {
    return entry.kind === 'calibration'
      ? calibrationCard(entry, this.calibration.getSummary(entry.id))
      : statsCard(entry, this.stats.getStats(entry.id));
  }
}
