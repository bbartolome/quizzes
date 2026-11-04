import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { APP_CLOCK } from '../../../../../core/app-clock';
import { Button } from '../../../../../shared/ui/button.directive';
import { FeedbackPanel } from '../../../../../shared/ui/feedback-panel';
import { PageBack, PageShell } from '../../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../../data/game-theory-data.service';
import { defaultBeautyConfig, runBeautyContest } from '../../../lib/beauty';
import type { BeautyResult, LevelLabel } from '../../../lib/beauty.types';
import type { ReasonCheck } from '../../../lib/puzzle.types';
import { GtEvidenceService } from '../../../state/gt-evidence.service';
import { GtGamesService } from '../../../state/gt-games.service';

const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };
const LEVELS: readonly LevelLabel[] = ['L0', 'L1', 'L2', 'L3', 'L4+'];

/** The reveal, already formatted for the template. */
interface Reveal {
  mean: string;
  target: string;
  winner: string;
  counts: readonly { label: LevelLabel; count: number }[];
}

function toReveal(result: BeautyResult): Reveal {
  return {
    mean: result.mean.toFixed(1),
    target: result.target.toFixed(1),
    winner: result.winnerIndex === -1 ? 'You won.' : 'A simulated player won.',
    counts: LEVELS.map((label) => ({ label, count: result.levelCounts[label] })),
  };
}

/**
 * Beauty contest, `play/beauty-contest` (spec §8.2). The player guesses from 0 to 100 against
 * simulated players. The players are a model, not data about people, and the page says so.
 */
@Component({
  selector: 'app-beauty-contest-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './beauty-contest-page.html',
  imports: [Button, FeedbackPanel, PageShell],
})
export class BeautyContestPage {
  private readonly clock = inject(APP_CLOCK);
  private readonly data = inject(GameTheoryDataService);
  private readonly evidence = inject(GtEvidenceService);
  private readonly games = inject(GtGamesService);
  /** Seeded from the clock once per page load, so a reload plays a fresh set of simulated players. */
  private readonly config = defaultBeautyConfig(this.clock().toISOString());

  readonly back = BACK;
  readonly saveFailed = this.games.saveFailed;
  readonly levels = LEVELS;
  readonly guessText = signal('');
  readonly invalid = signal(false);
  private readonly result = signal<BeautyResult | null>(null);
  readonly reveal = computed(() => {
    const result = this.result();
    return result ? toReveal(result) : null;
  });

  /** The reason checks from checks.json. A failed load drops the reason check; the reveal stays. */
  private readonly checks = signal<readonly ReasonCheck[]>([]);
  /** The beauty reason check (spec §5.3, §9.1), asked after the reveal. */
  readonly reasonCheck = computed(
    () => this.checks().find((check) => check.context === 'beauty') ?? null,
  );
  /** The option the player picked. The check is answered once per reveal. */
  private readonly picked = signal<string | null>(null);
  readonly pickedOption = computed(() => {
    const check = this.reasonCheck();
    const id = this.picked();
    return check && id ? (check.options.find((option) => option.id === id) ?? null) : null;
  });

  constructor() {
    this.data
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (loaded) => this.checks.set(loaded.checks.checks),
        error: () => this.checks.set([]),
      });
  }

  setGuess(event: Event): void {
    this.guessText.set((event.target as HTMLInputElement).value);
    this.invalid.set(false);
  }

  submit(): void {
    const value = Number(this.guessText());
    if (this.guessText().trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      this.invalid.set(true);
      this.result.set(null);
      return;
    }
    this.invalid.set(false);
    this.picked.set(null);
    const result = runBeautyContest(this.config, value);
    this.result.set(result);
    this.games.record({
      kind: 'beauty-contest',
      at: this.clock().toISOString(),
      seed: this.config.seed,
      summary: {
        guess: value,
        mean: result.mean,
        target: result.target,
        humanWon: result.winnerIndex === -1,
        simulated: this.config.simulated,
      },
    });
  }

  /** Records the reason answer as challenge evidence on its concept. Only the first pick counts. */
  pick(optionId: string): void {
    const check = this.reasonCheck();
    if (!check || this.picked() !== null) {
      return;
    }
    const option = check.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      return;
    }
    this.picked.set(optionId);
    this.evidence.record([check.conceptId], option.correct, 'challenges', this.clock());
  }
}
