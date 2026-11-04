import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, defer, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { KnowledgeBase, QuizManifestEntry } from '../../core/models/quiz.models';
import { PracticeService } from '../../core/services/practice.service';
import { APP_CLOCK } from '../../core/app-clock';
import { dateKeyOf } from '../../core/utils/dates';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { CalibrationBankService } from '../calibration/calibration-bank.service';
import { CalibrationHistoryService } from '../calibration/calibration-history.service';
import { EVIDENCE_QUIZ_IDS, GtLearnService } from '../game-theory/state/gt-learn.service';
import { Button } from '../../shared/ui/button.directive';
import { Card } from '../../shared/ui/card.directive';
import { PageShell } from '../../shared/ui/page-shell';
import { LibraryCard } from './library-card';
import { TodayPanel } from './today-panel';
import { InsightsList } from './insights-list';
import {
  QuizCard,
  calibrationCard,
  conceptIdsFor,
  formatPercent,
  gameTheoryCard,
  routeFor,
  statsCard,
} from './library-cards';
import { CollectionSummary, summarize } from './library-summary';

const RESET_ALL_MESSAGE = 'Reset all quiz progress and practice streak? This cannot be undone.';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, AsyncPipe, Button, Card, PageShell, LibraryCard, TodayPanel, InsightsList],
  templateUrl: './library-page.html',
})
export class LibraryPage {
  private readonly quizData: QuizDataService = inject(QuizDataService);
  private readonly stats: StatsService = inject(StatsService);
  private readonly calibration: CalibrationHistoryService = inject(CalibrationHistoryService);
  private readonly bankService: CalibrationBankService = inject(CalibrationBankService);
  private readonly practice: PracticeService = inject(PracticeService);
  private readonly gameTheory: GtLearnService = inject(GtLearnService);
  private readonly clock = inject(APP_CLOCK);

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
    switchMap((manifest) => this.knowledgeBase().pipe(map((kb) => ({ manifest, kb })))),
    map(({ manifest, kb }) =>
      [...manifest.quizzes]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((entry) => this.toCard(entry, kb)),
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

  /** The shared knowledge base, read once for the "Concepts practised N / M" line. Null if it cannot load. */
  private knowledgeBase(): Observable<KnowledgeBase | null> {
    return defer(() => this.quizData.loadKnowledgeBase()).pipe(catchError(() => of(null)));
  }

  private toCard(entry: QuizManifestEntry, kb: KnowledgeBase | null): QuizCard {
    if (entry.kind === 'game-theory') {
      const learn = this.gameTheory.read();
      return gameTheoryCard(
        entry,
        learn.summary,
        {
          cards: this.stats.getStats(EVIDENCE_QUIZ_IDS.cards),
          challenges: this.stats.getStats(EVIDENCE_QUIZ_IDS.challenges),
        },
        {
          unlocked: this.gameTheory.introduced.has('nash-equilibrium'),
          done: learn.daily[dateKeyOf(this.clock())] !== undefined,
        },
      );
    }
    return entry.kind === 'calibration'
      ? calibrationCard(entry, this.calibration.getSummary(entry.id))
      : statsCard(
          entry,
          this.stats.getStats(entry.id),
          kb ? conceptIdsFor(entry.kind, kb.concepts) : undefined,
          this.practice.conceptDays(),
        );
  }
}
