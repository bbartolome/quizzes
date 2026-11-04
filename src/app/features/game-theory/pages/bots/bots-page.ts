import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { APP_CLOCK } from '../../../../core/app-clock';
import { Button } from '../../../../shared/ui/button.directive';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { BOT_IDS, ROSTER } from '../../lib/bots';
import type { Bot, BotId, Move } from '../../lib/bots.types';
import { PD_DEFAULT, PLAY_HORIZON, resultOf, startMatch, stepTurn, type MatchState } from '../../lib/match';
import { GtGamesService } from '../../state/gt-games.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';

const MAX_NOISE = 0.1;
const CONTINUE_PERCENT = PLAY_HORIZON.kind === 'continue' ? Math.round(PLAY_HORIZON.p * 100) : 0;
const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };

/** Bots, mode `play` (spec §8.1): a repeated Prisoner's dilemma against one bot, a turn at a time. */
@Component({
  selector: 'app-bots-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bots-page.html',
  imports: [RouterLink, Button, EmptyState, PageShell],
})
export class BotsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly rng = inject(GAME_THEORY_RNG);
  private readonly clock = inject(APP_CLOCK);
  private readonly games = inject(GtGamesService);

  readonly back = BACK;
  readonly bots: readonly Bot[] = BOT_IDS.map((id) => ROSTER[id]);
  readonly continuePercent = CONTINUE_PERCENT;
  readonly saveFailed = this.games.saveFailed;

  private readonly mode = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('mode') ?? '')),
    { initialValue: '' },
  );
  /** Only `play` is handled here. Name-the-bot and the tournament are later slices. */
  readonly supported = computed(() => this.mode() === 'play');

  readonly selected = signal<BotId | null>(null);
  readonly noise = signal(0);
  readonly match = signal<MatchState | null>(null);

  readonly activeBot = computed<Bot | null>(() => {
    const id = this.selected();
    return id ? ROSTER[id] : null;
  });
  readonly activeName = computed(() => this.activeBot()?.name ?? '');
  readonly activeTell = computed(() => this.activeBot()?.tell ?? '');
  readonly noiseLabel = computed(() => this.noise().toFixed(2));
  readonly turns = computed(() => this.match()?.turns ?? []);
  readonly finished = computed(() => this.match()?.done === true);

  /** The totals of a finished match. Empty while a match is still going. */
  readonly summary = computed(() => {
    const state = this.match();
    if (!state || !state.done) {
      return null;
    }
    const result = resultOf(state);
    return { you: result.totalA, bot: result.totalB, mutual: result.mutualCooperation };
  });

  choose(id: BotId): void {
    this.selected.set(id);
  }

  setNoise(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.noise.set(Math.min(MAX_NOISE, Math.max(0, value)));
  }

  start(): void {
    const id = this.selected();
    if (!id) {
      return;
    }
    this.match.set(
      startMatch({
        a: 'human',
        b: id,
        horizon: PLAY_HORIZON,
        noise: this.noise(),
        payoffs: PD_DEFAULT,
        seed: this.clock().toISOString(),
      }),
    );
  }

  /** Plays the human's move for this turn. The last turn records the match once. */
  play(move: Move): void {
    const current = this.match();
    if (!current || current.done) {
      return;
    }
    const next = stepTurn(current, move, this.rng);
    this.match.set(next);
    if (next.done) {
      this.record(next);
    }
  }

  again(): void {
    this.match.set(null);
  }

  private record(state: MatchState): void {
    const result = resultOf(state);
    this.games.record({
      kind: 'repeated-pd',
      at: this.clock().toISOString(),
      seed: state.config.seed,
      summary: {
        bot: state.config.b,
        noise: state.config.noise,
        totalA: result.totalA,
        totalB: result.totalB,
        mutualCooperation: result.mutualCooperation,
      },
    });
  }
}
