import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { APP_CLOCK } from '../../../../core/app-clock';
import { Button } from '../../../../shared/ui/button.directive';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import { BOT_IDS, ROSTER } from '../../lib/bots';
import type { Bot, BotId, Move, TournamentResult } from '../../lib/bots.types';
import type { ReasonCheck } from '../../lib/puzzle.types';
import { reasonCheckFor } from '../../lib/reason-check';
import {
  PD_DEFAULT,
  PLAY_HORIZON,
  resultOf,
  startMatch,
  stepTurn,
  type MatchState,
} from '../../lib/match';
import { nameOptions, pickHiddenBot } from '../../lib/name-bot';
import { roundRobin } from '../../lib/tournament';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtGamesService } from '../../state/gt-games.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';

const MAX_NOISE = 0.1;
const CONTINUE_PERCENT = PLAY_HORIZON.kind === 'continue' ? Math.round(PLAY_HORIZON.p * 100) : 0;
const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };
const MODES = ['play', 'name', 'tournament'] as const;
type Mode = (typeof MODES)[number];

/** Name-the-bot plays ten turns (spec §8.1). */
const NAME_TURNS = 10;

/** The three populations the tournament offers (spec §8.1). Each is a fixed list of the roster. */
export type PresetId = 'everyone' | 'cooperative' | 'hostile';
const PRESETS: Readonly<Record<PresetId, { label: string; population: BotId[] }>> = {
  everyone: { label: 'Everyone (all eight)', population: [...BOT_IDS] },
  cooperative: {
    label: 'Cooperative four',
    population: ['always-cooperate', 'copycat', 'copykitten', 'simpleton'],
  },
  hostile: { label: 'Hostile four', population: ['always-cheat', 'detective', 'random', 'grudger'] },
};
const PRESET_IDS: readonly PresetId[] = ['everyone', 'cooperative', 'hostile'];

/** A tournament run: the setup it was played with, and its result. */
interface Run {
  preset: PresetId;
  noise: number;
  result: TournamentResult;
}

/** A run whose "did the winner change?" answer is still owed. */
interface Pending {
  run: Run;
  previous: Run;
}

/**
 * The bots page (spec §8.1). Three modes share the route: `play` (a repeated Prisoner's dilemma
 * against one bot, a turn at a time), `name` (name the hidden bot after ten turns), and `tournament`
 * (a round robin over a preset population, with a noise slider and the "did the winner change?"
 * check). Name-the-bot and the tournament record their evidence and games-log entries here.
 */
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
  private readonly evidence = inject(GtEvidenceService);
  private readonly data = inject(GameTheoryDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly back = BACK;
  readonly bots: readonly Bot[] = BOT_IDS.map((id) => ROSTER[id]);
  readonly continuePercent = CONTINUE_PERCENT;
  readonly saveFailed = this.games.saveFailed;
  readonly presets = PRESET_IDS.map((id) => ({ id, label: PRESETS[id].label }));
  readonly nameTurnCount = NAME_TURNS;

  private readonly mode_ = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('mode') ?? '')),
    { initialValue: '' },
  );
  readonly mode = computed(() => this.mode_());
  readonly supported = computed(() => (MODES as readonly string[]).includes(this.mode_()));

  /** The roster's checks, for the tournament's reason check. Empty until they load. */
  private readonly checks = signal<ReasonCheck[]>([]);

  // ---- play ----
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

  // ---- name-the-bot ----
  /** The hidden bot. Read only once the player has named it, so it never shows earlier. */
  readonly nameHidden = signal<BotId | null>(null);
  readonly nameMatch = signal<MatchState | null>(null);
  readonly nameChoices = signal<BotId[]>([]);
  readonly nameGuess = signal<BotId | null>(null);
  readonly nameTurns = computed(() => this.nameMatch()?.turns ?? []);
  readonly nameDone = computed(() => this.nameMatch()?.done === true);

  // ---- tournament ----
  readonly preset = signal<PresetId>('everyone');
  readonly tournamentNoise = signal(0);
  readonly tournamentNoiseLabel = computed(() => this.tournamentNoise().toFixed(2));
  readonly lastRun = signal<Run | null>(null);
  /** A run waiting for its "did the winner change?" answer. */
  readonly pending = signal<Pending | null>(null);
  /** The answer to the change check, once given, as a sentence. */
  readonly changeNote = signal<string | null>(null);
  readonly reasonCheck = signal<ReasonCheck | null>(null);
  readonly reasonPicked = signal<string | null>(null);

  constructor() {
    this.data
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => this.checks.set([...loaded.checks.checks]),
        error: () => this.checks.set([]),
      });
  }

  // ---- play ----

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

  // ---- name-the-bot ----

  nameOf(id: BotId | null): string {
    return id ? ROSTER[id].name : '';
  }

  tellOf(id: BotId | null): string {
    return id ? ROSTER[id].tell : '';
  }

  /** Draws the hidden bot first, then its four names, from the injected rng. */
  nameStart(): void {
    const hidden = pickHiddenBot(this.rng);
    this.nameHidden.set(hidden);
    this.nameChoices.set(nameOptions(hidden, this.rng));
    this.nameGuess.set(null);
    this.nameMatch.set(
      startMatch({
        a: 'human',
        b: hidden,
        horizon: { kind: 'fixed', turns: NAME_TURNS },
        noise: 0,
        payoffs: PD_DEFAULT,
        seed: this.clock().toISOString(),
      }),
    );
  }

  namePlay(move: Move): void {
    const current = this.nameMatch();
    if (!current || current.done) {
      return;
    }
    this.nameMatch.set(stepTurn(current, move, this.rng));
  }

  /** Grades the name. A right name is a challenge for the bot's concepts. Either way the games log records it. */
  nameChoose(id: BotId): void {
    const hidden = this.nameHidden();
    if (!hidden || !this.nameDone() || this.nameGuess() !== null) {
      return;
    }
    const correct = id === hidden;
    this.nameGuess.set(id);
    this.evidence.record(ROSTER[hidden].conceptIds, correct, 'challenges', this.clock());
    this.games.record({
      kind: 'name-the-bot',
      at: this.clock().toISOString(),
      seed: this.nameMatch()?.config.seed ?? '',
      summary: { correct, guessed: id, actual: hidden },
    });
  }

  nameAgain(): void {
    this.nameMatch.set(null);
    this.nameGuess.set(null);
  }

  // ---- tournament ----

  setPreset(id: PresetId): void {
    this.preset.set(id);
  }

  setTournamentNoise(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.tournamentNoise.set(Math.min(MAX_NOISE, Math.max(0, value)));
  }

  meanOf(run: Run, id: BotId): string {
    return run.result.meanPerTurn[id].toFixed(2);
  }

  /**
   * Plays the round robin. A run whose setup differs from the last one owes the change check, which
   * waits for its answer. Any other run is recorded at once.
   */
  runTournament(): void {
    const preset = this.preset();
    const noise = this.tournamentNoise();
    const run: Run = {
      preset,
      noise,
      result: roundRobin(PRESETS[preset].population, { noise, payoffs: PD_DEFAULT, reps: 1 }, this.rng),
    };
    const previous = this.lastRun();
    this.settlePending();
    this.lastRun.set(run);
    this.changeNote.set(null);
    this.reasonPicked.set(null);
    this.reasonCheck.set(reasonCheckFor(this.checks(), 'bots', ['tit-for-tat']));
    const changed = previous !== null && (previous.preset !== preset || previous.noise !== noise);
    if (previous && changed) {
      this.pending.set({ run, previous });
    } else {
      this.recordRun(run, null);
    }
  }

  /** Answers the change check: did the winner change between the two runs? Records it with the run. */
  answerChange(yes: boolean): void {
    const pending = this.pending();
    if (!pending) return;
    const winnerChanged = pending.run.result.ranking[0] !== pending.previous.result.ranking[0];
    const correct = yes === winnerChanged;
    this.pending.set(null);
    this.changeNote.set(
      `${winnerChanged ? 'The winner changed' : 'The winner did not change'}. Your answer was ${correct ? 'right' : 'wrong'}.`,
    );
    this.recordRun(pending.run, { previous: pending.previous, winnerChanged, correct });
  }

  /** Answers the bots reason check. A right reason is a challenge for tit-for-tat. */
  answerCheck(optionId: string): void {
    const check = this.reasonCheck();
    if (!check || this.reasonPicked() !== null) return;
    const option = check.options.find((o) => o.id === optionId);
    if (!option) return;
    this.evidence.record(check.conceptId ? [check.conceptId] : [], option.correct, 'challenges', this.clock());
    this.reasonPicked.set(optionId);
  }

  whyOf(check: ReasonCheck, optionId: string): string {
    return check.options.find((o) => o.id === optionId)?.why ?? '';
  }

  /** A run still owed its change check is recorded without one, when the player starts another run. */
  private settlePending(): void {
    const pending = this.pending();
    if (pending) {
      this.recordRun(pending.run, null);
      this.pending.set(null);
    }
  }

  private recordRun(
    run: Run,
    change: { previous: Run; winnerChanged: boolean; correct: boolean } | null,
  ): void {
    this.games.record({
      kind: 'tournament',
      at: this.clock().toISOString(),
      seed: `${run.preset}/${run.noise}`,
      summary: {
        population: run.preset,
        noise: run.noise,
        winner: run.result.ranking[0],
        ...(change
          ? {
              prevPopulation: change.previous.preset,
              prevNoise: change.previous.noise,
              prevWinner: change.previous.result.ranking[0],
              winnerChanged: change.winnerChanged,
              changeCheckCorrect: change.correct,
            }
          : {}),
      },
    });
  }
}
