import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { APP_CLOCK } from '../../../../../core/app-clock';
import { Button } from '../../../../../shared/ui/button.directive';
import { PageBack, PageShell } from '../../../../../shared/ui/page-shell';
import { defaultBeautyConfig, runBeautyContest } from '../../../lib/beauty';
import type { BeautyResult, LevelLabel } from '../../../lib/beauty.types';

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
  imports: [Button, PageShell],
})
export class BeautyContestPage {
  private readonly clock = inject(APP_CLOCK);
  /** Seeded from the clock once per page load, so a reload plays a fresh set of simulated players. */
  private readonly config = defaultBeautyConfig(this.clock().toISOString());

  readonly back = BACK;
  readonly levels = LEVELS;
  readonly guessText = signal('');
  readonly invalid = signal(false);
  private readonly result = signal<BeautyResult | null>(null);
  readonly reveal = computed(() => {
    const result = this.result();
    return result ? toReveal(result) : null;
  });

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
    this.result.set(runBeautyContest(this.config, value));
  }
}
