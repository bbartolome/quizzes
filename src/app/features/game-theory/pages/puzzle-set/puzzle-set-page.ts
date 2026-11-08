import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { APP_CLOCK } from '../../../../core/app-clock';
import type { MasteryState } from '../../../../core/models/practice.models';
import { PracticeService } from '../../../../core/services/practice.service';
import { StatsService } from '../../../../core/services/stats.service';
import { pooledConceptCounts } from '../../../../core/utils/concept-counts';
import { daysFor, masteryOf } from '../../../../core/utils/mastery';
import { Button } from '../../../../shared/ui/button.directive';
import { Callout } from '../../../../shared/ui/callout';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { FeedbackPanel } from '../../../../shared/ui/feedback-panel';
import { OUTCOME_LOOK } from '../../../../shared/ui/outcome-look';
import type { OptionRowState } from '../../../../shared/ui/option-row';
import { PageBack, PageShell } from '../../../../shared/ui/page-shell';
import { StatusBadge, type BadgeTone } from '../../../../shared/ui/status-badge';
import { GameTheoryDataService } from '../../data/game-theory-data.service';
import { strictlyDominates } from '../../lib/dominance';
import type { CellRef, GameClass, PayoffMatrix, Player } from '../../lib/matrix.types';
import type {
  Difficulty,
  Puzzle,
  PuzzleAnswer,
  PuzzleGrade,
  PuzzleKind,
  ReasonCheck,
} from '../../lib/puzzle.types';
import { classOf, generatePuzzle, gradePuzzle, matrixSignature } from '../../lib/puzzles';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { EVIDENCE_QUIZ_IDS, GtLearnService, countOf } from '../../state/gt-learn.service';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import {
  PayoffMatrixWidget,
  type BestResponseMarks,
  type CellGrade,
  type CellOutcome,
  type EliminatedLine,
} from '../../ui/payoff-matrix/payoff-matrix';
import { reasonCheckFor } from '../../lib/reason-check';
import { dailyPlanOf, dailyRng, type DailyPlan } from '../../lib/daily';
import type { Rng } from '../../lib/rng';
import { dateKeyOf } from '../../../../core/utils/dates';

/** A set is one puzzle kind, or `mixed`, which interleaves all three (spec §5.2, §7.2). */
type SetKind = PuzzleKind | 'mixed';
type Phase = 'empty' | 'unsupported' | 'blocked' | 'locked' | 'set' | 'summary';
type ChoiceOutcome = 'correct' | 'wrong' | 'missed';

/** A row or column the player removes. `index` is the strategy's index in the full game. */
interface Move {
  player: Player;
  index: number;
}

/** A gate on difficulty: a concept at Practised or Mastered (spec §7.2). `name` is how a note names it. */
interface Gate {
  conceptId: string;
  need: 'practised' | 'mastered';
  name: string;
}

interface ReasonRound {
  check: ReasonCheck;
  picked: string | null;
}

/** One item on screen: its puzzle, the difficulty it was drawn at, and the answer once graded. */
interface Item {
  index: number;
  puzzle: Puzzle;
  kind: PuzzleKind;
  requested: Difficulty;
  difficulty: Difficulty;
  heldBack: Gate | null;
  choice: GameClass | null;
  grade: PuzzleGrade | null;
  reason: ReasonRound | null;
}

const KINDS: readonly PuzzleKind[] = ['equilibrium', 'classify', 'eliminate'];
const SET_KINDS: readonly SetKind[] = [...KINDS, 'mixed'];
const SET_TITLE: Record<SetKind, string> = {
  equilibrium: 'Equilibrium puzzles',
  classify: 'Classify puzzles',
  eliminate: 'Eliminate puzzles',
  mixed: 'Mixed puzzles',
};
const KIND_LABEL: Record<PuzzleKind, string> = {
  equilibrium: 'Equilibrium',
  classify: 'Classify',
  eliminate: 'Eliminate',
};
/** The five class names, as the spec writes them (§5.1). */
const CLASS_LABEL: Record<GameClass, string> = {
  'prisoners-dilemma': "Prisoner's Dilemma",
  'stag-hunt': 'Stag Hunt',
  'chicken-game': 'Chicken',
  'battle-of-the-sexes': 'Battle of the Sexes',
  'coordination-game': 'Pure coordination',
  other: 'None of these',
};
const CLASS_IDS: readonly GameClass[] = [
  'prisoners-dilemma',
  'stag-hunt',
  'chicken-game',
  'battle-of-the-sexes',
  'coordination-game',
];
/** The concepts an equilibrium or elimination item credits. A classify item credits one class. */
const CONCEPTS_NEEDED: Record<'equilibrium' | 'eliminate', readonly string[]> = {
  equilibrium: ['best-response', 'nash-equilibrium'],
  eliminate: ['dominant-strategy', 'iterated-elimination'],
};
const LEVELS: readonly Difficulty[] = [1, 2, 3];
const ITEMS_PER_SET = 5;
/** A solo or test-out set has three items (spec §7.1, §7.2). */
const SOLO_ITEMS = 3;
/** A tutorial's Solo passes at two right; a test-out needs all three (spec §7.1, §7.2). */
const SOLO_PASS: Record<SoloMode, number> = { tutorial: 2, test: SOLO_ITEMS };

/** Solo mode, from the query: the concept, its level, and whether it feeds the lesson or a test-out. */
type SoloMode = 'tutorial' | 'test';
interface SoloParams {
  conceptId: string;
  level: Difficulty;
  mode: SoloMode;
}

function soloFrom(query: ParamMap): SoloParams | null {
  const conceptId = query.get('solo');
  if (!conceptId) return null;
  const level = Number(query.get('level') ?? 1);
  return {
    conceptId,
    level: (level === 2 || level === 3 ? level : 1) as Difficulty,
    mode: query.get('mode') === 'test' ? 'test' : 'tutorial',
  };
}
/** Generator draws tried per item before the set reports that it cannot draw. */
const DRAW_TRIES = 100;
const NASH = 'nash-equilibrium';
const DOMINANT = 'dominant-strategy';
const NASH_PRACTISED: Gate = {
  conceptId: NASH,
  need: 'practised',
  name: 'Nash equilibrium',
};
const NASH_MASTERED: Gate = {
  conceptId: NASH,
  need: 'mastered',
  name: 'Nash equilibrium',
};
const DOMINANT_PRACTISED: Gate = {
  conceptId: DOMINANT,
  need: 'practised',
  name: 'Dominant strategy',
};
const BACK: PageBack = { label: 'Game Theory', link: '/game-theory' };
/** The test-out for the first concept: a solo equilibrium set that needs all three to pass. */
const START_LINK = '/game-theory/puzzles/equilibrium';
const START_QUERY = { solo: 'best-response', level: 1, mode: 'test' } as const;
const CELL_OUTCOME: Record<'tp' | 'fp' | 'fn' | 'tn', CellOutcome | null> = {
  tp: 'correct',
  fp: 'wrong',
  fn: 'missed',
  tn: null,
};
const OUTCOME_WORDS: Record<ChoiceOutcome, string> = {
  correct: 'Correct answer',
  wrong: 'Your pick',
  missed: 'Correct answer',
};
const CHOICE_BASE =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface disabled:cursor-default';
const CHOICE_LOOK: Record<OptionRowState, string> = {
  idle: 'border-default',
  neutral: 'border-default',
  selected: 'border-accent bg-accent-subtle',
  correct: 'border-success bg-success-subtle',
  wrong: 'border-danger bg-danger-subtle',
  missed: 'border-warning bg-warning-subtle',
};

/**
 * The gates on an item at a difficulty (spec §7.2). Difficulty 2 needs nash-equilibrium Practised
 * for an equilibrium item and for any item of a mixed set. Difficulty 3 needs it Mastered, for every
 * kind. A 3x3 elimination needs dominant-strategy Practised. Difficulty 2 elimination is always 3x3,
 * and difficulty 3 may be, so the gate covers both levels. Difficulty 1 is never gated.
 */
function gatesFor(kind: PuzzleKind, mixed: boolean, difficulty: Difficulty): Gate[] {
  const gates: Gate[] = [];
  if (difficulty === 2 && (kind === 'equilibrium' || mixed)) {
    gates.push(NASH_PRACTISED);
  }
  if (difficulty === 3) {
    gates.push(NASH_MASTERED);
  }
  if (difficulty >= 2 && kind === 'eliminate') {
    gates.push(DOMINANT_PRACTISED);
  }
  return gates;
}

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i);

/** No best-response underlines. They would give the equilibrium away, so the player finds it alone. */
function noMarks(payoffs: PayoffMatrix): BestResponseMarks {
  const grid = () =>
    Array.from({ length: payoffs.rows }, () => Array.from({ length: payoffs.cols }, () => false));
  return { row: grid(), col: grid() };
}

/** Whether strategy a is strictly dominated by another strategy in the reduced game `sub`. */
function isDominated(sub: PayoffMatrix, player: Player, a: number): boolean {
  const count = player === 'row' ? sub.rows : sub.cols;
  return range(count).some((b) => b !== a && strictlyDominates(sub, player, b, a));
}

/** Every strategy still in the game, per player, after the moves already made. */
function remainingIndices(m: PayoffMatrix, made: readonly Move[]): { rows: number[]; cols: number[] } {
  return {
    rows: range(m.rows).filter((r) => !made.some((mv) => mv.player === 'row' && mv.index === r)),
    cols: range(m.cols).filter((c) => !made.some((mv) => mv.player === 'col' && mv.index === c)),
  };
}

/**
 * Every strategy still in the game, each offered as a removal. Only the strictly dominated ones are
 * legal, so a player has to tell them apart (spec §5.2).
 */
function remainingMoves(m: PayoffMatrix, made: readonly Move[]): Move[] {
  const { rows, cols } = remainingIndices(m, made);
  return [
    ...rows.map((index) => ({ player: 'row' as const, index })),
    ...cols.map((index) => ({ player: 'col' as const, index })),
  ];
}

/**
 * Every removal that strict dominance allows now, after the moves already made (spec §5.1, §11
 * M14). Dominance is judged in the reduced game, as the grader does.
 */
function legalEliminations(m: PayoffMatrix, made: readonly Move[]): Move[] {
  const { rows, cols } = remainingIndices(m, made);
  const sub: PayoffMatrix = {
    rows: rows.length,
    cols: cols.length,
    row: rows.map((r) => cols.map((c) => m.row[r][c])),
    col: rows.map((r) => cols.map((c) => m.col[r][c])),
  };
  const rowMoves: Move[] = rows.flatMap((index, a) =>
    isDominated(sub, 'row', a) ? [{ player: 'row' as const, index }] : [],
  );
  const colMoves: Move[] = cols.flatMap((index, a) =>
    isDominated(sub, 'col', a) ? [{ player: 'col' as const, index }] : [],
  );
  return [...rowMoves, ...colMoves];
}

/**
 * One puzzle set at `puzzles/:kind` (spec §5.2, §5.3, §7.2, §9.1). Each set has five items. Every
 * item is drawn from the injected rng, graded by gradePuzzle and recorded under challenges with its
 * own concept ids. A matching reason check follows the item. Nothing advances on its own.
 */
@Component({
  selector: 'app-puzzle-set-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './puzzle-set-page.html',
  imports: [
    Button,
    Callout,
    EmptyState,
    FeedbackPanel,
    PageShell,
    PayoffMatrixWidget,
    RouterLink,
    StatusBadge,
  ],
})
export class PuzzleSetPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(GameTheoryDataService);
  private readonly rng = inject(GAME_THEORY_RNG);
  private readonly clock = inject(APP_CLOCK);
  private readonly stats = inject(StatsService);
  private readonly practice = inject(PracticeService);
  private readonly evidence = inject(GtEvidenceService);
  private readonly learn = inject(GtLearnService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly back = BACK;
  protected readonly startLink = START_LINK;
  protected readonly startQuery = START_QUERY;
  protected readonly kindLabels = KIND_LABEL;
  protected readonly classLabels = CLASS_LABEL;
  protected readonly saveFailed = this.evidence.saveFailed;

  private readonly kindParam = signal('');
  /** The daily puzzle: one item, from the day's plan (spec §9.2). Its route has no kind parameter. */
  private readonly dataDaily = toSignal(
    this.route.data.pipe(map((data) => data['daily'] === true)),
    { initialValue: false },
  );
  protected readonly isDaily = computed(() => this.dataDaily());
  private readonly dailyPlan = signal<DailyPlan | null>(null);
  /** Locked until nash-equilibrium is introduced (spec §9.2). */
  private readonly lockedDaily = signal(false);
  private dailyStream: Rng | null = null;

  protected readonly setKind = computed<SetKind | null>(() => {
    if (this.isDaily()) return this.dailyPlan()?.kind ?? null;
    const kind = SET_KINDS.find((k) => k === this.kindParam()) ?? null;
    return this.isSolo() && kind === 'mixed' ? null : kind;
  });
  /** Solo mode reads its concept, level and mode from the query, and draws three items with no gate. */
  private readonly soloParams = signal<SoloParams | null>(null);
  protected readonly isSolo = computed(() => this.soloParams() !== null);
  protected readonly itemCount = computed(() => {
    if (this.isDaily()) return 1;
    return this.isSolo() ? SOLO_ITEMS : ITEMS_PER_SET;
  });
  /** Null until a solo set is finished. Then whether the pass rule for its mode was met. */
  protected readonly soloPassed = signal<boolean | null>(null);
  /** Says what the set is for, and what passing takes. Null for an ordinary puzzle set (spec §7.1, §9.2). */
  protected readonly modeNote = computed<string | null>(() => {
    if (this.isDaily()) return 'Today\u2019s puzzle. One item a day, and your answer is kept for today.';
    const params = this.soloParams();
    if (!params) return null;
    return params.mode === 'test'
      ? 'Test-out: all three right tests this idea out.'
      : 'Solo check: two right of three passes this idea.';
  });
  protected readonly soloBack = computed(() => {
    const params = this.soloParams();
    return params?.mode === 'test' ? '/game-theory' : `/game-theory/learn/${params?.conceptId ?? ''}`;
  });
  protected readonly title = computed(() => {
    if (this.isDaily()) return 'Daily puzzle';
    const kind = this.setKind();
    return kind ? SET_TITLE[kind] : 'Puzzles';
  });

  /** How many concepts were introduced when the set started. Zero means nothing to draw from (§7.2). */
  private readonly introducedCount = signal(0);
  /** The reason checks from checks.json. Puzzles draw without them, so a failed load only drops the asks. */
  private readonly checks = signal<readonly ReasonCheck[]>([]);
  protected readonly checksFailed = signal(false);

  /** The puzzles drawn so far in this set, so a repeat matrix can be avoided. */
  private drawn: Puzzle[] = [];
  /** One entry per graded item of this set, true when it was correct. */
  protected readonly results = signal<boolean[]>([]);
  protected readonly correctCount = computed(() => this.results().filter(Boolean).length);
  protected readonly current = signal<Item | null>(null);

  /** The equilibrium answer on screen. The widget two-way binds to these. */
  protected readonly selected = signal<CellRef[]>([]);
  protected readonly noneChosen = signal(false);
  /** The eliminations made so far on the current item, in order. */
  protected readonly moves = signal<Move[]>([]);

  protected readonly phase = computed<Phase>(() => {
    if (this.isDaily() && this.lockedDaily()) {
      return 'locked';
    }
    if (!this.isSolo() && !this.isDaily() && this.introducedCount() === 0) {
      return 'empty';
    }
    if (this.setKind() === null) {
      return 'unsupported';
    }
    // The fifth item stays on screen until its Next is pressed, so the summary waits for an empty slot.
    if (this.current()) {
      return 'set';
    }
    return this.results().length >= this.itemCount() ? 'summary' : 'blocked';
  });

  protected readonly hasAnswer = computed(() => this.noneChosen() || this.selected().length > 0);
  protected readonly marks = computed<BestResponseMarks | null>(() => {
    const item = this.current();
    return item ? noMarks(item.puzzle.game.payoffs) : null;
  });
  protected readonly cellGrades = computed<CellGrade[]>(() => {
    const grade = this.current()?.grade;
    if (!grade?.cellVerdicts) {
      return [];
    }
    return Object.entries(grade.cellVerdicts).flatMap(([key, verdict]) => {
      const outcome = CELL_OUTCOME[verdict];
      if (!outcome) {
        return [];
      }
      const [r, c] = key.split(',').map(Number);
      return [{ r, c, outcome }];
    });
  });
  protected readonly noneGrade = computed<CellOutcome | null>(() => {
    const item = this.current();
    const grade = item?.grade;
    if (!item || !grade || item.kind !== 'equilibrium') {
      return null;
    }
    if (this.noneChosen()) {
      return grade.correct ? 'correct' : 'wrong';
    }
    return this.equilibriumSolution(item).length === 0 ? 'missed' : null;
  });
  protected readonly eliminatedLines = computed<EliminatedLine[]>(() =>
    this.moves().map((move, i) => ({ player: move.player, index: move.index, step: i + 1 })),
  );
  /** Every strategy still in the game, each offered as a removal. */
  protected readonly remaining = computed<Move[]>(() => {
    const item = this.current();
    if (!item || item.grade || item.kind !== 'eliminate') {
      return [];
    }
    return remainingMoves(item.puzzle.game.payoffs, this.moves());
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((query) => {
      this.soloParams.set(soloFrom(query));
    });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.kindParam.set(params.get('kind') ?? '');
      this.startSet();
    });
    this.data
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => this.checks.set(loaded.checks.checks),
        error: () => this.checksFailed.set(true),
      });
  }

  /** Grades the equilibrium answer on screen. */
  protected submitEquilibrium(): void {
    const item = this.current();
    if (!item || item.grade || item.kind !== 'equilibrium' || !this.hasAnswer()) {
      return;
    }
    this.gradeWith({ kind: 'equilibrium', cells: this.noneChosen() ? [] : this.selected() });
  }

  /** A classify item is answered by its button. The choice grades at once. */
  protected chooseClass(choice: GameClass): void {
    const item = this.current();
    if (!item || item.grade || item.kind !== 'classify') {
      return;
    }
    this.current.set({ ...item, choice });
    this.gradeWith({ kind: 'classify', choice });
  }

  /** Removes one strategy. When none is left to remove, the item finishes and is graded. */
  protected eliminate(move: Move): void {
    const item = this.current();
    if (!item || item.grade || item.kind !== 'eliminate') {
      return;
    }
    const { payoffs } = item.puzzle.game;
    const legal = legalEliminations(payoffs, this.moves()).some(
      (m) => m.player === move.player && m.index === move.index,
    );
    const moves = [...this.moves(), move];
    this.moves.set(moves);
    // The grader stops at the first removal dominance does not allow, so that item is wrong at once.
    if (!legal) {
      this.gradeWith({ kind: 'eliminate', moves, done: false });
      return;
    }
    if (legalEliminations(payoffs, moves).length === 0) {
      this.gradeWith({ kind: 'eliminate', moves, done: true });
    }
  }

  /** The player stops while removals are still possible, which grades the item as stopped early. */
  protected stopElimination(): void {
    const item = this.current();
    if (!item || item.grade || item.kind !== 'eliminate') {
      return;
    }
    this.gradeWith({ kind: 'eliminate', moves: this.moves(), done: false });
  }

  /** Records the reason answer. The option's correctness is what the check's concept is credited with. */
  protected answerReason(optionId: string): void {
    const item = this.current();
    const reason = item?.reason;
    if (!item || !reason || reason.picked !== null) {
      return;
    }
    const option = reason.check.options.find((o) => o.id === optionId);
    if (!option) {
      return;
    }
    if (this.isDaily()) {
      // The daily’s reason is information only, so it is kept with the day’s answer and not scored (spec §9.2).
      this.learn.recordDailyAnswer(dateKeyOf(this.clock()), {
        kind: item.kind,
        correct: item.grade?.correct ?? false,
        reasonCorrect: option.correct,
      });
    } else {
      this.evidence.record(
        reason.check.conceptId ? [reason.check.conceptId] : [],
        option.correct,
        'challenges',
        this.clock(),
      );
    }
    this.current.set({ ...item, reason: { ...reason, picked: optionId } });
  }

  /** Moves to the next item, or to the summary after the fifth. */
  protected next(): void {
    const item = this.current();
    if (!item || !this.answered(item)) {
      return;
    }
    this.drawItem();
  }

  protected answered(item: Item): boolean {
    return item.grade !== null && (item.reason === null || item.reason.picked !== null);
  }

  protected isLast(item: Item): boolean {
    return item.index === this.itemCount() - 1;
  }

  /** The note for an item held back below the level its set asked for, or null. */
  protected heldBackNote(item: Item): string | null {
    if (!item.heldBack) {
      return null;
    }
    const verb = item.heldBack.need === 'mastered' ? 'Master' : 'Practise';
    return `Held at difficulty ${item.difficulty}. ${verb} ${item.heldBack.name} to unlock difficulty ${item.requested}.`;
  }

  /** The lesson that teaches the concept a held-back item needs, or null. */
  protected heldBackLesson(item: Item): string | null {
    return item.heldBack ? `/game-theory/learn/${item.heldBack.conceptId}` : null;
  }

  protected choices(item: Item): GameClass[] {
    return item.puzzle.kind === 'classify' ? item.puzzle.choices : [];
  }

  protected choiceClass(item: Item, choice: GameClass): string {
    const outcome = this.choiceOutcome(item, choice);
    const state: OptionRowState = outcome ? OUTCOME_LOOK[outcome].state : 'idle';
    return `${CHOICE_BASE} ${CHOICE_LOOK[state]}`;
  }

  /** The non-colour words for a classify choice once graded: the answer, and the player's pick. */
  protected choiceStatus(item: Item, choice: GameClass): { tone: BadgeTone; label: string } | null {
    const outcome = this.choiceOutcome(item, choice);
    return outcome ? { tone: OUTCOME_LOOK[outcome].tone, label: OUTCOME_WORDS[outcome] } : null;
  }

  protected moveLabel(item: Item, move: Move): string {
    const labels = move.player === 'row' ? item.puzzle.game.rowLabels : item.puzzle.game.colLabels;
    return `${move.player === 'row' ? 'Eliminate row' : 'Eliminate column'} ${labels[move.index]}`;
  }

  protected reasonClass(reason: ReasonRound, optionId: string): string {
    const state: OptionRowState = reason.picked === optionId ? 'selected' : 'idle';
    return `${CHOICE_BASE} ${CHOICE_LOOK[state]}`;
  }

  protected reasonPicked(reason: ReasonRound): ReasonCheck['options'][number] | null {
    return reason.check.options.find((option) => option.id === reason.picked) ?? null;
  }

  protected reasonAnswer(reason: ReasonRound): string {
    return reason.check.options.find((option) => option.correct)?.text ?? '';
  }

  private gradeWith(answer: PuzzleAnswer): void {
    const item = this.current();
    if (!item) {
      return;
    }
    const grade = gradePuzzle(item.puzzle, answer);
    this.evidence.record(item.puzzle.conceptIds, grade.correct, 'challenges', this.clock());
    this.results.update((all) => [...all, grade.correct]);
    if (this.isDaily()) {
      // The day's one answer is kept, and the reason is added later as information only (spec §9.2).
      this.learn.recordDailyAnswer(dateKeyOf(this.clock()), {
        kind: item.kind,
        correct: grade.correct,
        reasonCorrect: false,
      });
      this.evidence.recordDaily(this.clock());
    }
    // Solo items ask no reason check (spec §7.1). The equilibrium check asks about a stable cell, so
    // an item with no pure equilibrium, where "None of these" is right, asks none.
    const noStableCell = item.puzzle.kind === 'equilibrium' && item.puzzle.solution.length === 0;
    const check =
      this.isSolo() || noStableCell
        ? null
        : reasonCheckFor(this.checks(), item.kind, item.puzzle.conceptIds);
    this.current.set({ ...item, grade, reason: check ? { check, picked: null } : null });
    if (this.isSolo() && this.results().length === SOLO_ITEMS) {
      this.finishSolo();
    }
  }

  /** Starts the set again, from its first item, with the same kind and level. */
  protected startFresh(): void {
    this.startSet();
  }

  private startSet(): void {
    this.drawn = [];
    this.results.set([]);
    this.soloPassed.set(null);
    this.introducedCount.set(this.learn.introduced.size);
    if (this.isDaily()) {
      this.startDaily();
      return;
    }
    this.drawItem();
  }

  /**
   * Plans today's daily on its first open and stores the plan, so it stays fixed for the day (spec
   * §9.2). A plan from an earlier day is replaced. Nothing is drawn while the daily is locked.
   */
  private startDaily(): void {
    if (!this.learn.introduced.has(NASH)) {
      this.lockedDaily.set(true);
      this.dailyPlan.set(null);
      this.current.set(null);
      return;
    }
    this.lockedDaily.set(false);
    const today = dateKeyOf(this.clock());
    let plan = this.learn.plan();
    if (plan?.dateKey !== today) {
      plan = dailyPlanOf(today, KINDS.filter((kind) => this.drawableKind(kind)), (id) => this.isPractised(id));
      if (plan) this.learn.setPlan(plan);
    }
    this.dailyPlan.set(plan);
    // One answer a day (spec §9.2). A reopened daily shows today's saved answer and draws nothing.
    const saved = this.learn.read().daily[today];
    if (saved) {
      this.results.set([saved.correct]);
      this.current.set(null);
      return;
    }
    this.dailyStream = dailyRng(today);
    this.drawItem();
  }

  private isPractised(conceptId: string): boolean {
    const state = this.stateOf(conceptId);
    return state === 'practised' || state === 'mastered';
  }

  /** Draws the next item of the set, or none once the set is complete or nothing can be drawn. */
  private drawItem(): void {
    const set = this.setKind();
    const index = this.results().length;
    const kinds = set ? this.drawableKinds(set) : [];
    if (!set || kinds.length === 0 || index >= this.itemCount()) {
      this.current.set(null);
      return;
    }
    const kind = kinds[index % kinds.length];
    // A solo set and the daily are drawn at their fixed level, with no gate (spec §7.1, §9.2).
    const fixed = this.isDaily() ? this.dailyPlan()?.difficulty : this.soloParams()?.level;
    const requested = fixed ?? this.requestedLevel();
    const { difficulty, heldBack } =
      fixed !== undefined
        ? { difficulty: requested, heldBack: null }
        : this.difficultyFor(kind, set === 'mixed', requested);
    const puzzle = this.drawPuzzle(kind, difficulty);
    if (!puzzle) {
      this.current.set(null);
      return;
    }
    this.drawn = [...this.drawn, puzzle];
    this.selected.set([]);
    this.noneChosen.set(false);
    this.moves.set([]);
    this.current.set({
      index,
      puzzle,
      kind,
      requested,
      difficulty,
      heldBack,
      choice: null,
      grade: null,
      reason: null,
    });
  }

  /** The level the set asks for: one more for each correct item so far, from difficulty 1 (§7.2). */
  private requestedLevel(): Difficulty {
    const correct = this.correctCount();
    if (correct >= 2) {
      return 3;
    }
    return correct === 1 ? 2 : 1;
  }

  /**
   * The difficulty an item is drawn at. If a gate on the requested level is unmet, the item steps
   * down to the highest level whose gates are met. The first unmet gate on the requested level is
   * returned, so the page can say which gate held the item back.
   */
  private difficultyFor(
    kind: PuzzleKind,
    mixed: boolean,
    requested: Difficulty,
  ): { difficulty: Difficulty; heldBack: Gate | null } {
    const blocker = gatesFor(kind, mixed, requested).find((gate) => !this.gateMet(gate));
    if (!blocker) {
      return { difficulty: requested, heldBack: null };
    }
    const lower = LEVELS.filter((level) => level < requested).reverse();
    const difficulty =
      lower.find((level) => gatesFor(kind, mixed, level).every((gate) => this.gateMet(gate))) ?? 1;
    return { difficulty, heldBack: blocker };
  }

  /** Kinds that can draw from the introduced concepts. A mixed set rotates through all of them. */
  private drawableKinds(set: SetKind): PuzzleKind[] {
    if (this.isSolo() || this.isDaily()) return set === 'mixed' ? [] : [set];
    const candidates: PuzzleKind[] = set === 'mixed' ? [...KINDS] : [set];
    return candidates.filter((kind) => this.drawableKind(kind));
  }

  private drawableKind(kind: PuzzleKind): boolean {
    const introduced = this.learn.introduced;
    if (kind === 'classify') {
      return CLASS_IDS.some((id) => introduced.has(id));
    }
    return CONCEPTS_NEEDED[kind].every((id) => introduced.has(id));
  }

  /**
   * Draws one puzzle of the kind and difficulty, avoiding the matrices already in the set. Only a
   * puzzle whose concepts are all introduced is kept (§7.2), so a redraw happens for a repeat or an
   * unintroduced concept. Returns null if no draw in DRAW_TRIES passes.
   */
  private drawPuzzle(kind: PuzzleKind, difficulty: Difficulty): Puzzle | null {
    const introduced = this.learn.introduced;
    const avoid = this.drawn.map((p) => matrixSignature(p.game));
    // A solo classify set is one class: the lesson's own, so its items test and credit that concept.
    const onlyClass = this.isSolo() && kind === 'classify' ? classOf(this.soloParams()?.conceptId) : undefined;
    for (let tries = 0; tries < DRAW_TRIES; tries++) {
      const stream = this.isDaily() && this.dailyStream ? this.dailyStream : this.rng;
      const puzzle = generatePuzzle(kind, difficulty, stream, { avoid, onlyClass });
      // A solo set draws without the introduced gate, since a test-out is what introduces its concept.
      if (this.isSolo() || puzzle.conceptIds.every((id) => introduced.has(id))) {
        return puzzle;
      }
    }
    return null;
  }

  private gateMet(gate: Gate): boolean {
    const state = this.stateOf(gate.conceptId);
    return gate.need === 'mastered'
      ? state === 'mastered'
      : state === 'practised' || state === 'mastered';
  }

  /**
   * A concept's mastery state (§7.3): cards and challenges pooled, the challenge attempts and the
   * practice days. nash-equilibrium has an equilibrium mode in concepts.json, so Mastered needs
   * challenge evidence, and dominant-strategy is only ever checked at Practised.
   */
  private stateOf(conceptId: string): MasteryState {
    const cards = this.stats.getStats(EVIDENCE_QUIZ_IDS.cards);
    const challenges = this.stats.getStats(EVIDENCE_QUIZ_IDS.challenges);
    const pooled = pooledConceptCounts([cards, challenges], new Set([conceptId])).get(
      conceptId,
    ) ?? { attempted: 0, correct: 0 };
    return masteryOf({
      attempted: pooled.attempted,
      correct: pooled.correct,
      days: daysFor(this.practice.conceptDays()[conceptId], pooled.attempted),
      challengeAttempts: countOf(challenges.perTrait[conceptId])?.attempted ?? 0,
      requiresChallenge: true,
    });
  }

  /** Decides a finished solo set against its mode's pass rule, and records the result (spec §7.1, §7.2). */
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

  private equilibriumSolution(item: Item): CellRef[] {
    return item.puzzle.kind === 'equilibrium' ? item.puzzle.solution : [];
  }

  private choiceOutcome(item: Item, choice: GameClass): ChoiceOutcome | null {
    if (!item.grade || item.puzzle.kind !== 'classify') {
      return null;
    }
    // A wrong pick reveals the true class as missed (a warning, as on the cards), not as a pass.
    if (choice === item.puzzle.solution) {
      return item.choice === choice ? 'correct' : 'missed';
    }
    return item.choice === choice ? 'wrong' : null;
  }
}
