import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { APP_CLOCK } from '../../../../core/app-clock';
import type { GameTheoryConcept } from '../../../../core/models/quiz.models';
import { Button } from '../../../../shared/ui/button.directive';
import { Callout } from '../../../../shared/ui/callout';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { FeedbackPanel, type Verdict } from '../../../../shared/ui/feedback-panel';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import type { CellRef, PayoffMatrix } from '../../lib/matrix.types';
import type { Puzzle, PuzzleGrade } from '../../lib/puzzle.types';
import { generatePuzzle, gradePuzzle } from '../../lib/puzzles';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import {
  PayoffMatrixWidget,
  type BestResponseMarks,
  type CellGrade,
  type CellOutcome,
} from '../../ui/payoff-matrix/payoff-matrix';

/** The concepts that have a test so far: the two seed concepts (spec §7.1). */
const TESTABLE: readonly string[] = ['best-response', 'nash-equilibrium'];
const ITEMS_PER_SET = 3;
const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };

/** Each verdict from gradeEquilibrium, mapped to the widget's grade. A true negative shows nothing. */
const CELL_OUTCOME: Record<'tp' | 'fp' | 'fn' | 'tn', CellOutcome | null> = {
  tp: 'correct',
  fp: 'wrong',
  fn: 'missed',
  tn: null,
};

type Content =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; concepts: readonly GameTheoryConcept[] };

type Phase = 'unsupported' | 'loading' | 'failed' | 'test';

/** The best-response flags for a matrix, all false. The test shows no hints (spec §7.1). */
function noMarks(payoffs: PayoffMatrix): BestResponseMarks {
  const grid = () =>
    Array.from({ length: payoffs.rows }, () => Array.from({ length: payoffs.cols }, () => false));
  return { row: grid(), col: grid() };
}

/** The cells a puzzle's answer is judged against, as the solver returned them. */
function equilibriaOf(puzzle: Puzzle): CellRef[] {
  return puzzle.kind === 'equilibrium' ? puzzle.solution : [];
}

/**
 * The test-out page for one concept (spec §7.1). Three equilibrium items from the Solo generator,
 * each graded and recorded under the challenges facet. A 3 of 3 pass calls testOut. Any miss starts
 * a fresh set. Nothing advances on its own: each step waits for the player's click.
 */
@Component({
  selector: 'app-test-out-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './test-out-page.html',
  imports: [Button, Callout, EmptyState, FeedbackPanel, PageShell, PayoffMatrixWidget, RouterLink],
})
export class TestOutPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(GameTheoryDataService);
  private readonly rng = inject(GAME_THEORY_RNG);
  private readonly clock = inject(APP_CLOCK);
  private readonly evidence = inject(GtEvidenceService);
  private readonly learn = inject(GtLearnService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly back = BACK;

  private readonly conceptId = signal('');
  protected readonly content = signal<Content>({ status: 'loading' });

  /** The concept's name from the content, or null while loading, on failure or when it is missing. */
  protected readonly name = computed<string | null>(() => {
    const loaded = this.content();
    if (loaded.status !== 'ready') {
      return null;
    }
    return loaded.concepts.find((c) => c.id === this.conceptId())?.name ?? null;
  });

  /** An id with no test never waits on content. Otherwise the view follows the content load. */
  protected readonly phase = computed<Phase>(() => {
    if (!TESTABLE.includes(this.conceptId())) {
      return 'unsupported';
    }
    const loaded = this.content();
    if (loaded.status === 'loading') {
      return 'loading';
    }
    if (loaded.status === 'failed') {
      return 'failed';
    }
    return this.name() === null ? 'unsupported' : 'test';
  });

  protected readonly title = computed(() => this.name() ?? 'Test out');
  protected readonly eyebrow = computed(() => (this.name() === null ? undefined : 'Test out'));

  protected readonly items = signal<Puzzle[]>([]);
  protected readonly index = signal(0);
  protected readonly results = signal<boolean[]>([]);
  /** Set by the two-way bindings to the widget. */
  protected readonly selected = signal<CellRef[]>([]);
  protected readonly noneChosen = signal(false);
  /** The graded item, with whether the player chose None. Null until Submit. */
  protected readonly graded = signal<{ result: PuzzleGrade; none: boolean } | null>(null);
  /** Whether the testOut write for a 3 of 3 pass was kept. Null until a pass is scored. */
  protected readonly passSaved = signal<boolean | null>(null);

  protected readonly puzzle = computed<Puzzle | null>(() => this.items()[this.index()] ?? null);
  protected readonly marks = computed<BestResponseMarks | null>(() => {
    const current = this.puzzle();
    return current ? noMarks(current.game.payoffs) : null;
  });
  protected readonly hasAnswer = computed(() => this.noneChosen() || this.selected().length > 0);
  protected readonly setComplete = computed(() => this.results().length === ITEMS_PER_SET);
  protected readonly passed = computed(
    () => this.setComplete() && this.results().every((correct) => correct),
  );

  /** Widget grades after Submit: each cell with a verdict, and the None button. */
  protected readonly cellGrades = computed<CellGrade[]>(() => {
    const done = this.graded();
    if (!done?.result.cellVerdicts) {
      return [];
    }
    return Object.entries(done.result.cellVerdicts).flatMap(([key, verdict]) => {
      const outcome = CELL_OUTCOME[verdict];
      if (!outcome) {
        return [];
      }
      const [r, c] = key.split(',').map(Number);
      return [{ r, c, outcome }];
    });
  });

  protected readonly noneGrade = computed<CellOutcome | null>(() => {
    const done = this.graded();
    const current = this.puzzle();
    if (!done || !current) {
      return null;
    }
    if (done.none) {
      return done.result.correct ? 'correct' : 'wrong';
    }
    return equilibriaOf(current).length === 0 ? 'missed' : null;
  });

  protected readonly verdict = computed<Verdict | null>(() => {
    const done = this.graded();
    return done ? (done.result.correct ? 'correct' : 'incorrect') : null;
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('concept') ?? '';
      this.conceptId.set(id);
      if (TESTABLE.includes(id)) {
        this.startSet();
      }
    });
    this.loadContent(false);
  }

  protected retry(): void {
    this.loadContent(true);
  }

  protected submit(): void {
    const current = this.puzzle();
    if (!current || this.graded() || !this.hasAnswer()) {
      return;
    }
    const none = this.noneChosen();
    const result = gradePuzzle(current, {
      kind: 'equilibrium',
      cells: none ? [] : this.selected(),
    });
    this.graded.set({ result, none });
    this.evidence.record(current.conceptIds, result.correct, 'challenges', this.clock());
    this.results.update((all) => [...all, result.correct]);
    if (this.passed()) {
      this.passSaved.set(this.learn.testOut(this.conceptId()));
    }
  }

  protected next(): void {
    if (!this.graded() || this.setComplete()) {
      return;
    }
    this.index.update((i) => i + 1);
    this.clearAnswer();
  }

  /** Draws a set of three items, in order, from the injected rng. */
  protected startSet(): void {
    this.items.set(
      Array.from({ length: ITEMS_PER_SET }, () => generatePuzzle('equilibrium', 1, this.rng)),
    );
    this.index.set(0);
    this.results.set([]);
    this.passSaved.set(null);
    this.clearAnswer();
  }

  private clearAnswer(): void {
    this.selected.set([]);
    this.noneChosen.set(false);
    this.graded.set(null);
  }

  private loadContent(retrying: boolean): void {
    this.content.set({ status: 'loading' });
    const source = retrying ? this.data.retry() : this.data.load();
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (loaded) => this.content.set({ status: 'ready', concepts: loaded.concepts.concepts }),
      error: () => this.content.set({ status: 'failed' }),
    });
  }
}
