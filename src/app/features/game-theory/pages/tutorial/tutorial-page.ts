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
import type { GameTheoryConcept, GameTheoryContent } from '../../../../core/models/quiz.models';
import { FlashCard, buildCard } from '../../../flash-cards/card-builder';
import { Feedback, buildFeedback } from '../../../flash-cards/feedback';
import { Button } from '../../../../shared/ui/button.directive';
import { Callout } from '../../../../shared/ui/callout';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { FeedbackPanel, type Verdict } from '../../../../shared/ui/feedback-panel';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import { checkFaded, defaultScript, type Strategy } from '../../lib/tutorial';
import { resolveMark } from '../../lib/tutorial-marks';
import type { CellRef, MatrixGame } from '../../lib/matrix.types';
import type { BestResponseMarks, EliminatedLine } from '../../ui/payoff-matrix/payoff-matrix';
import { PayoffMatrixWidget } from '../../ui/payoff-matrix/payoff-matrix';
import type { TutorialScript, TutorialStep } from '../../lib/tutorial.types';
import { GtLearnService } from '../../state/gt-learn.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';

type Phase = 'loading' | 'failed' | 'unsupported' | 'lesson';

interface CardRound {
  target: GameTheoryConcept;
  card: FlashCard<GameTheoryConcept>;
  picked: number | null;
  feedback: Feedback | null;
}

const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };
const NO_MARKS = (game: MatrixGame): BestResponseMarks => {
  const grid = () =>
    Array.from({ length: game.payoffs.rows }, () =>
      Array.from({ length: game.payoffs.cols }, () => false),
    );
  return { row: grid(), col: grid() };
};

/** The solo route for a step's source: a puzzle set in solo mode, or the cards page. */
function soloRoute(
  conceptId: string,
  source: Extract<TutorialStep, { kind: 'solo' }>['source'],
  mode: 'tutorial' | 'test',
): { commands: string[]; query: Record<string, string | number> } {
  if (typeof source === 'string') {
    return { commands: ['/game-theory/cards'], query: { solo: conceptId, mode } };
  }
  return {
    commands: ['/game-theory/puzzles', source.puzzle],
    query: { solo: conceptId, level: source.difficulty, mode },
  };
}

/**
 * One concept's tutorial (spec §7.1). Explore and Try run here: the text and worked example, then the
 * faded task or the default card. Stage progress is recorded as the lesson reaches it: Explore done is
 * stage 1, and Try begun is stage 2. The Solo runs on the puzzle or cards page, in solo mode, and
 * records stage 3 there. Nothing here is evidence, so Try answers are never scored.
 */
@Component({
  selector: 'app-tutorial-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutorial-page.html',
  imports: [Button, Callout, EmptyState, FeedbackPanel, PageShell, PayoffMatrixWidget, RouterLink],
})
export class TutorialPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(GameTheoryDataService);
  private readonly learn = inject(GtLearnService);
  private readonly rng = inject(GAME_THEORY_RNG);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly back = BACK;

  private readonly conceptId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('concept') ?? '')),
    { initialValue: '' },
  );
  private readonly content = signal<GameTheoryContent | null>(null);
  private readonly scripts = signal<readonly TutorialScript[]>([]);
  protected readonly status = signal<'loading' | 'failed' | 'ready'>('loading');

  protected readonly concept = computed<GameTheoryConcept | null>(
    () => this.content()?.concepts.find((c) => c.id === this.conceptId()) ?? null,
  );
  /** The hand-written script if there is one, otherwise the default card script (§7.1). */
  protected readonly script = computed<TutorialScript | null>(() => {
    const concept = this.concept();
    if (!concept) return null;
    return (
      this.scripts().find((s) => s.conceptId === concept.id) ?? defaultScript(concept)
    );
  });
  protected readonly steps = computed<readonly TutorialStep[]>(() => this.script()?.steps ?? []);
  protected readonly phase = computed<Phase>(() => {
    if (this.status() === 'loading') return 'loading';
    if (this.status() === 'failed') return 'failed';
    return this.concept() && this.script() ? 'lesson' : 'unsupported';
  });
  protected readonly title = computed(() => this.concept()?.name ?? 'Tutorial');

  /** The step on screen, and the stage it belongs to. */
  protected readonly index = signal(0);
  protected readonly step = computed<TutorialStep | null>(() => this.steps()[this.index()] ?? null);

  /** Worked examples reveal one annotation per Next. */
  protected readonly revealed = signal(1);
  protected readonly annotations = computed(() => {
    const current = this.step();
    return current?.kind === 'worked' ? current.annotations : [];
  });
  protected readonly shownNotes = computed(() => this.annotations().slice(0, this.revealed()));
  /** The solver's marks for the notes shown so far, drawn on the matrix. */
  protected readonly workedMarks = computed(() => {
    const current = this.step();
    if (!current || current.kind !== 'worked') return null;
    const blank = NO_MARKS(current.game);
    const selected: CellRef[] = [];
    const eliminated: EliminatedLine[] = [];
    for (const note of this.shownNotes()) {
      if (!note.mark) continue;
      const resolved = resolveMark(note.mark, current.game);
      if (note.mark === 'best-response-row') {
        resolved.cells.forEach(({ r, c }) => (blank.row[r][c] = true));
      } else if (note.mark === 'best-response-col') {
        resolved.cells.forEach(({ r, c }) => (blank.col[r][c] = true));
      } else {
        selected.push(...resolved.cells);
      }
      for (const s of resolved.strategies) {
        eliminated.push({ player: s.player, index: s.index, step: eliminated.length + 1 });
      }
    }
    return { marks: blank, selected, eliminated };
  });

  /** The faded task's answer, bound to the widget. */
  protected readonly answer = signal<CellRef[]>([]);
  protected readonly noneChosen = signal(false);
  protected readonly strategy = signal<Strategy | null>(null);
  protected readonly verdict = signal<Verdict | null>(null);
  protected readonly hintsShown = signal(0);
  protected readonly visibleHints = computed(() => {
    const current = this.step();
    return current?.kind === 'faded' || current?.kind === 'card'
      ? current.hints.slice(0, this.hintsShown())
      : [];
  });
  /** Under the widget, the row player's best responses are drawn as given when the task gives them. */
  protected readonly givenMarks = computed(() => {
    const current = this.step();
    if (!current || current.kind !== 'faded') return null;
    const blank = NO_MARKS(current.game);
    for (const { r, c } of current.given ?? []) blank.row[r][c] = true;
    return blank;
  });
  protected readonly strategies = computed<Strategy[]>(() => {
    const current = this.step();
    if (!current || current.kind !== 'faded' || current.task !== 'eliminate-next') return [];
    const m = current.game.payoffs;
    return [
      ...Array.from({ length: m.rows }, (_, index) => ({ player: 'row' as const, index })),
      ...Array.from({ length: m.cols }, (_, index) => ({ player: 'col' as const, index })),
    ];
  });

  /** The default card Try: one card for the concept, drawn from the injected rng. */
  protected readonly round = signal<CardRound | null>(null);

  protected readonly solo = computed(() => {
    const current = this.steps().find((s) => s.kind === 'solo');
    if (!current || current.kind !== 'solo') return null;
    return soloRoute(this.conceptId(), current.source, 'tutorial');
  });
  protected readonly testOut = computed(() => {
    const current = this.steps().find((s) => s.kind === 'solo');
    if (!current || current.kind !== 'solo') return null;
    return soloRoute(this.conceptId(), current.source, 'test');
  });
  protected readonly passed = computed(() => this.learn.read().concepts[this.conceptId()]?.stage === 3);

  constructor() {
    this.loadContent(false);
  }

  protected retry(): void {
    this.loadContent(true);
  }

  /** Moves on from the step on screen. Only a finished step can be left. */
  protected next(): void {
    const current = this.step();
    if (!current) return;
    if (current.kind === 'worked' && this.revealed() < this.annotations().length) {
      this.revealed.update((n) => n + 1);
      return;
    }
    if (current.kind === 'faded' && this.verdict() !== 'correct') return;
    if (current.kind === 'card' && !this.round()?.feedback) return;
    this.advance();
  }

  /** Grades the faded task against the solver. A wrong answer reveals the next hint. */
  protected check(): void {
    const current = this.step();
    if (!current || current.kind !== 'faded' || this.verdict() === 'correct') return;
    const answer = current.task === 'eliminate-next' ? this.strategy() : this.answerCells();
    if (answer === null) return;
    const ok = checkFaded(current.task, current.game, answer, current.given ?? []);
    this.verdict.set(ok ? 'correct' : 'incorrect');
    if (!ok) this.revealHint();
  }

  protected pickStrategy(strategy: Strategy): void {
    this.strategy.set(strategy);
    this.verdict.set(null);
  }

  protected revealHint(): void {
    const current = this.step();
    if (!current || (current.kind !== 'faded' && current.kind !== 'card')) return;
    this.hintsShown.update((n) => Math.min(n + 1, current.hints.length));
  }

  protected hintsLeft(): boolean {
    const current = this.step();
    return !!current && (current.kind === 'faded' || current.kind === 'card')
      ? this.hintsShown() < current.hints.length
      : false;
  }

  protected pickCard(index: number): void {
    const current = this.round();
    if (!current || current.feedback) return;
    this.round.set({ ...current, picked: index });
  }

  /** Checks the picked card against its target and shows the feedback. */
  protected checkCard(): void {
    const current = this.round();
    const kb = this.content();
    if (!current || !kb || current.feedback || current.picked === null) return;
    const options = current.card.optionConcepts;
    const picked = options[current.picked];
    const correct = picked.id === current.target.id;
    const feedback = buildFeedback(current.target, correct ? null : picked, options, kb);
    this.round.set({ ...current, feedback });
  }

  private answerCells(): CellRef[] | null {
    return this.answer() ?? null;
  }

  /** Records the stage the lesson has reached, then moves to the next step. */
  private advance(): void {
    const id = this.conceptId();
    const from = this.step();
    const nextIndex = this.index() + 1;
    if (from?.stage === 1 && (this.steps()[nextIndex]?.stage ?? 9) >= 2) {
      this.learn.setStage(id, 1);
    }
    this.index.set(nextIndex);
    this.resetStep();
    const to = this.step();
    if (to && to.stage >= 2) {
      this.learn.setStage(id, 2);
    }
    if (to?.kind === 'card') {
      this.startCard();
    }
  }

  /** The stage a learner returns to: Explore done goes to the Try, Try done goes to the Solo. */
  private startIndexFor(steps: readonly TutorialStep[], stage: number): number {
    const want = stage >= 2 ? 3 : stage === 1 ? 2 : 1;
    const found = steps.findIndex((s) => s.stage === want);
    return found >= 0 ? found : 0;
  }

  private resetStep(): void {
    this.revealed.set(1);
    this.answer.set([]);
    this.noneChosen.set(false);
    this.strategy.set(null);
    this.verdict.set(null);
    this.hintsShown.set(0);
    this.round.set(null);
  }

  private startCard(): void {
    const concept = this.concept();
    const kb = this.content();
    if (!concept || !kb) return;
    const card = buildCard(concept, kb, this.rng);
    this.round.set({ target: concept, card, picked: null, feedback: null });
  }

  private loadContent(retrying: boolean): void {
    this.status.set('loading');
    const source = retrying ? this.data.retry() : this.data.load();
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (loaded) => {
        this.content.set(loaded.concepts);
        this.scripts.set(loaded.tutorials.tutorials);
        this.status.set('ready');
        const stage = this.learn.read().concepts[this.conceptId()]?.stage ?? 0;
        this.index.set(this.startIndexFor(this.steps(), stage));
        if (this.step()?.kind === 'card') this.startCard();
      },
      error: () => this.status.set('failed'),
    });
  }
}
