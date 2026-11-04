import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { GameTheoryContent } from '../../../../core/models/quiz.models';
import { Button } from '../../../../shared/ui/button.directive';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import { buildConceptMap, type ConceptMapTier } from '../../lib/concept-map';
import { requiresChallengeMap } from '../../lib/requires-challenge';
import { GAME_THEORY_MODES } from '../../modes';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';

type LoadStatus = 'loading' | 'failed' | 'ready';

/**
 * The game-theory hub (spec §3.1, §7.3). Loads the content on every visit, runs the content
 * migration and refreshes the summary, then draws the concept map. The mode list comes from
 * GAME_THEORY_MODES. The today slot is still reserved for the daily puzzle (G27).
 */
@Component({
  selector: 'app-game-theory-home-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-theory-home-page.html',
  imports: [Button, PageShell, RouterLink],
})
export class GameTheoryHomePage {
  private readonly data = inject(GameTheoryDataService);
  private readonly evidence = inject(GtEvidenceService);
  private readonly learn = inject(GtLearnService);
  private readonly destroyRef = inject(DestroyRef);

  readonly modes = GAME_THEORY_MODES;
  readonly back: PageBack = { label: 'All collections', link: '/' };

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly tiers = signal<ConceptMapTier[]>([]);

  constructor() {
    this.loadContent(false);
  }

  protected retry(): void {
    this.loadContent(true);
  }

  private loadContent(retrying: boolean): void {
    this.status.set('loading');
    const source = retrying ? this.data.retry() : this.data.load();
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (loaded) => this.onLoaded(loaded.concepts),
      error: () => this.status.set('failed'),
    });
  }

  /** Migrates the stored evidence, refreshes the summary with the requiresChallenge map, then draws the map. */
  private onLoaded(content: GameTheoryContent): void {
    const ids = content.concepts.map((concept) => concept.id);
    this.evidence.migrateContent(content.version, ids);
    this.learn.refresh(ids, requiresChallengeMap(content.concepts));
    this.tiers.set(
      buildConceptMap(content.concepts, this.learn.masteryByConcept(ids), this.learn.introduced),
    );
    this.status.set('ready');
  }
}
