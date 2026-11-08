import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { GameTheoryContent } from '../../../../core/models/quiz.models';
import { APP_CLOCK } from '../../../../core/app-clock';
import { addDays, dateKeyOf } from '../../../../core/utils/dates';
import { Button } from '../../../../shared/ui/button.directive';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import { buildConceptMap, type ConceptMapTier } from '../../lib/concept-map';
import { requiresChallengeMap } from '../../lib/requires-challenge';
import { GAME_THEORY_MODES } from '../../modes';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';

/** The hub’s daily state for today: locked, open, or done with its answer. */
type TodayState = { kind: 'locked' } | { kind: 'open' } | { kind: 'done'; correct: boolean };
/** The daily history glyphs, oldest first, for the last fourteen days (spec §9.2). */
const STRIP_DAYS = 14;

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
  private readonly clock = inject(APP_CLOCK);

  readonly modes = GAME_THEORY_MODES;
  readonly back: PageBack = { label: 'All collections', link: '/' };

  protected readonly status = signal<LoadStatus>('loading');
  protected readonly tiers = signal<ConceptMapTier[]>([]);
  protected readonly today = signal<TodayState>({ kind: 'locked' });
  /** Today's answer, when it is done. The template reads it so it can narrow the type. */
  protected readonly doneToday = computed(() => {
    const state = this.today();
    return state.kind === 'done' ? state : null;
  });
  protected readonly strip = signal('');
  protected readonly confirming = signal(false);

  constructor() {
    this.loadContent(false);
  }

  protected retry(): void {
    this.loadContent(true);
  }

  protected cancelReset(): void {
    this.confirming.set(false);
  }

  /**
   * Clears every stats:game-theory: key (spec §10), then reloads the hub. Other keys, such as the
   * practice streak, stay. The confirmation is the second press of the reset button.
   */
  protected reset(): void {
    const storage = globalThis.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith('stats:game-theory:')) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
    this.confirming.set(false);
    this.loadContent(false);
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
    const introduced = this.learn.introduced;
    this.tiers.set(buildConceptMap(content.concepts, this.learn.masteryByConcept(ids), introduced));
    this.today.set(this.todayState(introduced));
    this.strip.set(this.historyStrip());
    this.status.set('ready');
  }

  /** Today’s state: locked until nash-equilibrium is introduced, then open, then done. */
  private todayState(introduced: ReadonlySet<string>): TodayState {
    if (!introduced.has('nash-equilibrium')) return { kind: 'locked' };
    const entry = this.learn.read().daily[dateKeyOf(this.clock())];
    return entry ? { kind: 'done', correct: entry.correct } : { kind: 'open' };
  }

  /** The last fourteen days, oldest first: a tick for right, a cross for wrong, a dot for no answer. */
  private historyStrip(): string {
    const daily = this.learn.read().daily;
    const today = dateKeyOf(this.clock());
    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const entry = daily[addDays(today, i - (STRIP_DAYS - 1))];
      if (!entry) return '\u00b7';
      return entry.correct ? '\u2713' : '\u2717';
    }).join('');
  }

  /** The strip's accessible name: the count of each mark, so a screen reader hears the result, not the dots. */
  protected stripLabel(): string {
    const marks = [...this.strip()];
    const count = (mark: string) => marks.filter((m) => m === mark).length;
    return `${count('\u2713')} right, ${count('\u2717')} wrong, ${count('\u00b7')} no answer`;
  }
}
