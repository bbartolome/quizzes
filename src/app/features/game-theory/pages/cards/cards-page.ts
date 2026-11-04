import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { APP_CLOCK } from '../../../../core/app-clock';
import type {
  GameTheoryConcept,
  GameTheoryContent,
  QuizStats,
} from '../../../../core/models/quiz.models';
import { StatsService } from '../../../../core/services/stats.service';
import { FlashCard, buildCard } from '../../../flash-cards/card-builder';
import { baseWeights, drawTarget } from '../../../flash-cards/draw-weights';
import { Feedback, buildFeedback } from '../../../flash-cards/feedback';
import { Button } from '../../../../shared/ui/button.directive';
import { Callout } from '../../../../shared/ui/callout';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { FeedbackPanel } from '../../../../shared/ui/feedback-panel';
import { OUTCOME_LOOK, Outcome } from '../../../../shared/ui/outcome-look';
import type { OptionRowState } from '../../../../shared/ui/option-row';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { StatusBadge } from '../../../../shared/ui/status-badge';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import { requiresChallengeMap } from '../../lib/requires-challenge';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { EVIDENCE_QUIZ_IDS, GtLearnService } from '../../state/gt-learn.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';

type LoadStatus = 'loading' | 'failed' | 'ready';
type Phase = 'loading' | 'failed' | 'empty' | 'cards' | 'summary';

/** The card on screen: its target, the card drawn for it, the option picked, and the feedback once checked. */
interface Round {
  target: GameTheoryConcept;
  card: FlashCard<GameTheoryConcept>;
  picked: number | null;
  feedback: Feedback | null;
}

const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };
/** A solo set has three cards. A tutorial's passes at two right; a test-out needs all three (spec §7.1, §7.2). */
const SOLO_ITEMS = 3;
const SOLO_PASS: Record<SoloMode, number> = { tutorial: 2, test: SOLO_ITEMS };

/** Solo mode, from the query: one concept, and whether it feeds the lesson or a test-out. */
type SoloMode = 'tutorial' | 'test';
interface SoloParams {
  conceptId: string;
  mode: SoloMode;
}

function soloFrom(query: ParamMap): SoloParams | null {
  const conceptId = query.get('solo');
  if (!conceptId) return null;
  return { conceptId, mode: query.get('mode') === 'test' ? 'test' : 'tutorial' };
}
/** Every card set starts from the seed concept's test (spec §7.2). */
const START_LINK = '/game-theory/test-out/best-response';
/** Game theory keeps no reasoning-traps stats, so the trap half of the pooled draw weight is empty. */
const NO_TRAP_STATS: QuizStats = {
  quizId: 'reasoning-traps',
  version: 0,
  perTrait: {},
  streak: 0,
  roundsPlayed: 0,
};
/** Cards have no confused-partner bumps, so a draw never raises a weight. */
const NO_BUMPS: ReadonlySet<string> = new Set<string>();
/** The non-colour words for the outcomes that show a label, as the flash-card round does. */
const OUTCOME_LABELS: Partial<Record<Outcome, string>> = {
  correct: 'Correct answer',
  wrong: 'Your pick',
  missed: 'Correct answer',
};
const OPTION_BASE =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface disabled:cursor-default';
const OPTION_LOOK: Record<OptionRowState, string> = {
  idle: 'border-default',
  neutral: 'border-default',
  selected: 'border-accent bg-accent-subtle',
  correct: 'border-success bg-success-subtle',
  wrong: 'border-danger bg-danger-subtle',
  missed: 'border-warning bg-warning-subtle',
};

/**
 * The flash-card round for game theory (spec §7.2, §9.1). Each card's target is drawn only from
 * the introduced concepts, and its lures from the whole deck. Each check is a scored attempt under
 * `cards`, and End records the session. One card is on screen at a time, so there is one primary button.
 */
@Component({
  selector: 'app-cards-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cards-page.html',
  imports: [Button, Callout, EmptyState, FeedbackPanel, PageShell, RouterLink, StatusBadge],
})
export class CardsPage {
  private readonly data = inject(GameTheoryDataService);
  private readonly rng = inject(GAME_THEORY_RNG);
  private readonly clock = inject(APP_CLOCK);
  private readonly stats = inject(StatsService);
  private readonly evidence = inject(GtEvidenceService);
  private readonly learn = inject(GtLearnService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  protected readonly back = BACK;
  /** Solo mode: one concept, three cards, and a pass rule by mode (spec §7.1). */
  private readonly soloParams = signal<SoloParams | null>(null);
  protected readonly isSolo = computed(() => this.soloParams() !== null);
  /** Null until a solo set ends. Then whether the pass rule for its mode was met. */
  protected readonly soloPassed = signal<boolean | null>(null);
  protected readonly soloBack = computed(() => {
    const params = this.soloParams();
    return params?.mode === 'test' ? '/game-theory' : `/game-theory/learn/${params?.conceptId ?? ''}`;
  });
  protected readonly startLink = START_LINK;
  protected readonly outcomeLook = OUTCOME_LOOK;
  protected readonly outcomeLabels = OUTCOME_LABELS;
  protected readonly saveFailed = this.evidence.saveFailed;

  protected readonly status = signal<LoadStatus>('loading');
  /** The loaded content. Lures are drawn from all of it (§7.2). */
  private kb: GameTheoryContent | null = null;
  /** The introduced concepts, the only pool a target is drawn from (§7.2). */
  private readonly deck = signal<GameTheoryConcept[]>([]);
  protected readonly round = signal<Round | null>(null);
  protected readonly answeredCount = signal(0);
  protected readonly correctCount = signal(0);
  protected readonly ended = signal(false);
  /** The target of the last card, which the next draw leaves out. */
  private lastTarget: GameTheoryConcept | null = null;

  protected readonly phase = computed<Phase>(() => {
    if (this.status() === 'loading') {
      return 'loading';
    }
    if (this.status() === 'failed') {
      return 'failed';
    }
    if (this.ended()) {
      return 'summary';
    }
    return this.deck().length === 0 ? 'empty' : 'cards';
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((query) => {
      this.soloParams.set(soloFrom(query));
    });
    this.loadContent(false);
  }

  protected retry(): void {
    this.loadContent(true);
  }

  /** Records the option picked on the current card. Ignored once that card is checked. */
  protected pick(index: number): void {
    const current = this.round();
    if (!current || current.feedback) {
      return;
    }
    this.round.set({ ...current, picked: index });
  }

  /** Locks the current card, records the attempt under cards and shows the feedback. */
  protected check(): void {
    const current = this.round();
    const kb = this.kb;
    if (!current || !kb || current.feedback || current.picked === null) {
      return;
    }
    const options = current.card.optionConcepts;
    const picked = options[current.picked];
    const correct = picked.id === current.target.id;
    const feedback = buildFeedback(current.target, correct ? null : picked, options, kb);
    this.evidence.record([current.target.id], correct, 'cards', this.clock());
    this.answeredCount.update((count) => count + 1);
    if (correct) {
      this.correctCount.update((count) => count + 1);
    }
    this.round.set({ ...current, feedback });
  }

  protected next(): void {
    if (!this.round()?.feedback) return;
    if (this.isSolo() && this.answeredCount() === SOLO_ITEMS) {
      this.finishSolo();
      this.end();
      return;
    }
    this.drawRound();
  }

  /** Starts a fresh solo set with the same concept and mode. */
  protected startFresh(): void {
    this.answeredCount.set(0);
    this.correctCount.set(0);
    this.ended.set(false);
    this.soloPassed.set(null);
    this.lastTarget = null;
    this.drawRound();
  }

  /** Decides a finished solo set against its mode's pass rule, and records the result. */
  private finishSolo(): void {
    const params = this.soloParams();
    if (!params) return;
    const passed = this.correctCount() >= SOLO_PASS[params.mode];
    this.soloPassed.set(passed);
    if (!passed) return;
    if (params.mode === 'test') {
      this.learn.testOut(params.conceptId);
    } else {
      this.learn.setStage(params.conceptId, 3);
    }
  }

  /** Ends the session: records the session end, which only counts if a card was checked, and shows the summary. */
  protected end(): void {
    if (this.ended()) {
      return;
    }
    this.evidence.recordSessionEnd();
    this.round.set(null);
    this.ended.set(true);
  }

  /** The outcome of option `index` once the card is checked; null before that. */
  protected outcomeOf(round: Round, index: number): Outcome | null {
    if (!round.feedback) {
      return null;
    }
    if (index === round.card.correctIndex) {
      return round.picked === index ? 'correct' : 'missed';
    }
    return round.picked === index ? 'wrong' : 'neutral';
  }

  /** The option's border and background: its outcome once checked, otherwise selected or idle. */
  protected optionClass(round: Round, index: number): string {
    const outcome = this.outcomeOf(round, index);
    let state: OptionRowState = round.picked === index ? 'selected' : 'idle';
    if (outcome) {
      state = OUTCOME_LOOK[outcome].state;
    }
    return `${OPTION_BASE} ${OPTION_LOOK[state]}`;
  }

  /** Draws the next target from the introduced concepts, then builds its card from the whole deck. */
  private drawRound(): void {
    const kb = this.kb;
    if (!kb) {
      return;
    }
    const deck = this.deck();
    const weights = baseWeights(deck, NO_TRAP_STATS, this.stats.getStats(EVIDENCE_QUIZ_IDS.cards));
    const target = drawTarget(deck, this.lastTarget, weights, NO_BUMPS, this.rng);
    const card = buildCard(target, kb, this.rng);
    this.lastTarget = target;
    this.round.set({ target, card, picked: null, feedback: null });
  }

  private loadContent(retrying: boolean): void {
    this.status.set('loading');
    const source = retrying ? this.data.retry() : this.data.load();
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (loaded) => this.onLoaded(loaded.concepts),
      error: () => this.status.set('failed'),
    });
  }

  /**
   * Runs once the content has loaded (§10): migrates both evidence keys, refreshes the summary
   * with the requiresChallenge map, and then draws the first card if anything is introduced.
   */
  private onLoaded(content: GameTheoryContent): void {
    const ids = content.concepts.map((concept) => concept.id);
    this.evidence.migrateContent(content.version, ids);
    this.learn.refresh(ids, requiresChallengeMap(content.concepts));
    const introduced = this.learn.introduced;
    this.kb = content;
    const solo = this.soloParams();
    // A solo set draws only its own concept, so the rest of the deck is lures alone (spec §7.1).
    this.deck.set(
      solo
        ? content.concepts.filter((concept) => concept.id === solo.conceptId)
        : content.concepts.filter((concept) => introduced.has(concept.id)),
    );
    this.status.set('ready');
    if (this.deck().length > 0) {
      this.drawRound();
    }
  }
}
