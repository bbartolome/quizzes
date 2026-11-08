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
import { APP_CLOCK } from '../../../../../core/app-clock';
import { Button } from '../../../../../shared/ui/button.directive';
import { EmptyState } from '../../../../../shared/ui/empty-state';
import { PageBack, PageShell } from '../../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../../data/game-theory-data.service';
import type { AuctionOutcome, AuctionSetup, BidPolicyId, ValueModel } from '../../../lib/auctions.types';
import { bidRange, simulateAuctions } from '../../../lib/auctions';
import { drawValues, otherPolicy, resolveWithBid, summarize, type DrawnAuction, type AuctionSummary } from '../../../lib/auction-play';
import type { AuctionFormat } from '../../../lib/auctions.types';
import { reasonCheckFor } from '../../../lib/reason-check';
import type { ReasonCheck } from '../../../lib/puzzle.types';
import { GtEvidenceService } from '../../../state/gt-evidence.service';
import { GtGamesService } from '../../../state/gt-games.service';
import { GAME_THEORY_RNG } from '../../../state/gt-tokens';
import type { GameKind } from '../../../lib/state.types';

/** One of the three auction games, and what each one teaches (spec §8.3). */
type Game = 'first-price' | 'second-price' | 'common-value';
interface GameSetup {
  title: string;
  format: AuctionFormat;
  model: ValueModel;
  context: ReasonCheck['context'];
  conceptId: string;
}
const GAMES: Readonly<Record<Game, GameSetup>> = {
  'first-price': {
    title: 'First-price auction',
    format: 'first-price',
    model: 'private',
    context: 'auction-first',
    conceptId: 'first-price-auction',
  },
  'second-price': {
    title: 'Second-price auction',
    format: 'second-price',
    model: 'private',
    context: 'auction-second',
    conceptId: 'second-price-auction',
  },
  'common-value': {
    title: 'Common-value auction',
    format: 'first-price',
    model: 'common',
    context: 'auction-common',
    conceptId: 'winners-curse',
  },
};
const GAME_IDS = Object.keys(GAMES) as Game[];

/** The policies the simulate panel offers for each setup (spec §8.3). */
const POLICY_LABEL: Record<BidPolicyId, string> = {
  truthful: 'truthfully',
  'equilibrium-shade': 'with the equilibrium shade',
  'naive-signal': 'at your signal',
  'curse-aware': 'with the winner\'s-curse adjustment',
  'noisy-shade': 'with a noisy shade',
};
/** The same policies, read after "The other bidders bid". A naive-signal bidder bids their own signal. */
const OTHER_BIDDER_LABEL: Record<BidPolicyId, string> = {
  ...POLICY_LABEL,
  'naive-signal': 'at their own signal',
};
const SIMULATIONS = 1000;
const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };

function policiesFor(setup: AuctionSetup): BidPolicyId[] {
  if (setup.model === 'common') return ['naive-signal', 'curse-aware'];
  return setup.format === 'first-price' ? ['equilibrium-shade', 'truthful'] : ['truthful'];
}

/**
 * One auction game, at `play/:game` (spec §8.3). The player is bidder 0 and picks a bid, and the
 * others follow a fixed policy. Each resolved auction is recorded in the games log; playing is not a
 * scored attempt, but the reason check after the result is (§9.1). The simulate panel runs 1000
 * auctions with a chosen policy, in this setup only.
 */
@Component({
  selector: 'app-auction-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auction-page.html',
  imports: [Button, EmptyState, PageShell, RouterLink],
})
export class AuctionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly rng = inject(GAME_THEORY_RNG);
  private readonly clock = inject(APP_CLOCK);
  private readonly games = inject(GtGamesService);
  private readonly evidence = inject(GtEvidenceService);
  private readonly data = inject(GameTheoryDataService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly back = BACK;
  private readonly gameParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('game') ?? '')),
    { initialValue: '' },
  );
  protected readonly game = computed<Game | null>(() => {
    const id = this.gameParam();
    return (GAME_IDS as string[]).includes(id) ? (id as Game) : null;
  });
  protected readonly info = computed<GameSetup | null>(() => {
    const g = this.game();
    return g ? GAMES[g] : null;
  });
  protected readonly title = computed(() => this.info()?.title ?? 'Auction');

  protected readonly bidders = signal(4);
  protected readonly bidderCount = computed(() => this.bidders().toString());
  /** The auction on screen: the player's own value or signal, and every bidder's value. */
  protected readonly drawn = signal<DrawnAuction | null>(null);
  protected readonly bid = signal(50);
  protected readonly outcome = signal<AuctionOutcome | null>(null);
  protected readonly reason = signal<{ check: ReasonCheck; picked: string | null } | null>(null);
  protected readonly policy = signal<BidPolicyId | null>(null);
  protected readonly simulated = signal<{ policy: BidPolicyId; summary: AuctionSummary } | null>(null);

  private readonly checks = signal<ReasonCheck[]>([]);

  protected readonly setup = computed<AuctionSetup | null>(() => {
    const info = this.info();
    if (!info) return null;
    return { format: info.format, model: info.model, bidders: this.bidders(), seed: '' };
  });
  protected readonly own = computed(() => this.drawn()?.own[0] ?? 0);
  /** The bid slider's range: the signal range for common values, so every signal can be bid near (spec §8.3). */
  protected readonly bidBounds = computed(() => bidRange(this.info()?.model ?? 'private'));
  protected readonly policies = computed<BidPolicyId[]>(() => {
    const s = this.setup();
    return s ? policiesFor(s) : [];
  });
  protected readonly policyLabel = (id: BidPolicyId) => POLICY_LABEL[id];
  protected readonly winnerIs = computed(() => this.outcome()?.winner ?? -1);
  protected readonly ownProfit = computed(() => this.outcome()?.payoffs[0] ?? 0);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.draw();
    });
    this.data
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => this.checks.set([...loaded.checks.checks]),
        error: () => this.checks.set([]),
      });
  }

  /** Draws a new auction from the injected rng. The player's own value or signal is part of the draw. */
  protected draw(): void {
    const s = this.setup();
    if (!s) return;
    this.drawn.set(drawValues(s, this.rng));
    this.bid.set(50);
    this.outcome.set(null);
    this.reason.set(null);
    this.simulated.set(null);
    this.policy.set(policiesFor(s)[0] ?? null);
  }

  protected setBidders(event: Event): void {
    const value = Math.min(8, Math.max(3, Math.round(Number((event.target as HTMLInputElement).value))));
    this.bidders.set(value);
    this.draw();
  }

  protected setBid(event: Event): void {
    const { min, max } = this.bidBounds();
    const value = Math.round(Number((event.target as HTMLInputElement).value));
    this.bid.set(Math.min(max, Math.max(min, value)));
  }

  /** Settles the auction with the player's bid. The result is recorded, and the reason check follows. */
  protected submit(): void {
    const s = this.setup();
    const info = this.info();
    const drawn = this.drawn();
    const g = this.game();
    if (!s || !info || !drawn || !g || this.outcome()) return;
    const result = resolveWithBid(s, drawn, this.bid(), this.rng);
    this.outcome.set(result);
    this.games.record({
      kind: g as GameKind,
      at: this.clock().toISOString(),
      seed: `${g}/${s.bidders}`,
      summary: {
        bid: this.bid(),
        price: result.price,
        won: result.winner === 0,
        profit: result.payoffs[0],
        bidders: s.bidders,
      },
    });
    const check = reasonCheckFor(this.checks(), info.context, [info.conceptId]);
    this.reason.set(check ? { check, picked: null } : null);
  }

  /** Records the reason answer under the check's concept. */
  protected answerReason(optionId: string): void {
    const current = this.reason();
    if (!current || current.picked !== null) return;
    const option = current.check.options.find((o) => o.id === optionId);
    if (!option) return;
    this.evidence.record(
      current.check.conceptId ? [current.check.conceptId] : [],
      option.correct,
      'challenges',
      this.clock(),
    );
    this.reason.set({ ...current, picked: optionId });
  }

  protected setPolicy(id: BidPolicyId): void {
    this.policy.set(id);
  }

  /** Runs the simulate panel: 1000 auctions with the chosen policy, in this setup. */
  protected simulate(): void {
    const s = this.setup();
    const policy = this.policy();
    if (!s || !policy) return;
    const outcomes = simulateAuctions(
      { ...s, seed: `sim/${this.game()}/${s.bidders}` },
      policy,
      SIMULATIONS,
    );
    this.simulated.set({ policy, summary: summarize(outcomes) });
  }

  /** A value, price or profit rounded to the nearest whole number for display. */
  protected whole(value: number): number {
    return Math.round(value);
  }

  protected otherPolicyLabel(): string {
    const s = this.setup();
    return s ? OTHER_BIDDER_LABEL[otherPolicy(s)] : '';
  }
}
