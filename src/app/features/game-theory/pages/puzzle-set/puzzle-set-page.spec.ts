import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { PuzzleSetPage } from './puzzle-set-page';
import { GameTheoryData, GameTheoryDataService } from '../../data/game-theory-data.service';
import type { CellRef, PayoffMatrix } from '../../lib/matrix.types';
import type { Difficulty, Puzzle, PuzzleKind, ReasonCheck } from '../../lib/puzzle.types';
import { generatePuzzle, matrixSignature } from '../../lib/puzzles';
import { mulberry32 } from '../../lib/rng';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';
import { APP_CLOCK } from '../../../../core/app-clock';
import { StatsService } from '../../../../core/services/stats.service';
import { PracticeService } from '../../../../core/services/practice.service';
import type { PerTraitStats, QuizStats } from '../../../../core/models/quiz.models';
import { FakeGtEvidenceService } from '../../../../../testing/fake-gt-evidence.service';
import { FakeGtLearnService } from '../../../../../testing/fake-gt-learn.service';
import type { DailyPlan } from '../../lib/daily';
import { dailyRng } from '../../lib/daily';
import { dateKeyOf } from '../../../../core/utils/dates';

// A fixed seed makes every item deterministic. expectedSet() replays the page's draw order, so a
// test knows each item's puzzle, and can answer it right or wrong.
const SEED = 20260101;
const NOW = new Date('2026-11-03T12:00:00Z');

const EQUILIBRIUM_IDS = ['best-response', 'nash-equilibrium', 'pareto-efficiency'];
const CLASSIFY_IDS = [
  'prisoners-dilemma',
  'stag-hunt',
  'chicken-game',
  'battle-of-the-sexes',
  'coordination-game',
];
const ELIMINATE_IDS = ['dominant-strategy', 'iterated-elimination'];

const NASH_CHECK: ReasonCheck = {
  id: 'equilibrium-stable-not-best',
  conceptId: 'nash-equilibrium',
  context: 'equilibrium',
  prompt: 'Why is the cell you picked an equilibrium?',
  options: [
    {
      id: 'a',
      text: 'Neither player gains by switching alone',
      correct: true,
      why: 'That is the definition of a stable cell.',
    },
    {
      id: 'b',
      text: 'It pays both players the most',
      correct: false,
      misconceptionId: 'M2',
      why: 'Stable is not the same as best.',
    },
  ],
};

const ELIMINATE_CHECK: ReasonCheck = {
  id: 'elimination-strict-order',
  conceptId: 'iterated-elimination',
  context: 'eliminate',
  prompt: 'Why can the order of removals not change the answer?',
  options: [
    {
      id: 'a',
      text: 'Each removal is strictly dominated, so it stays dominated',
      correct: true,
      why: 'Strict dominance is order-independent.',
    },
    { id: 'b', text: 'Any removal is allowed', correct: false, why: 'Only dominated ones are.' },
  ],
};

const DATA: GameTheoryData = {
  concepts: { version: 1, concepts: [], pairs: [] },
  tutorials: { version: 1, tutorials: [] },
  checks: { version: 1, checks: [] },
};

interface Counts {
  attempted: number;
  correct: number;
}

interface OpenOptions {
  kind?: string;
  introduced?: string[];
  /** Attempted and correct per concept, under the challenges key. */
  challenges?: Record<string, Counts>;
  days?: Record<string, { days: number; lastDay: string }>;
  checks?: ReasonCheck[];
  checksFail?: boolean;
  saveFails?: boolean;
  /** Route query params, for the solo and test-out modes (spec §7.1, §7.2). */
  query?: Record<string, string>;
  /** Opens the daily puzzle route (spec §9.2). */
  daily?: boolean;
  /** A daily plan already stored before the page opens. */
  plan?: DailyPlan;
  /** An answer for today already stored before the page opens (spec §9.2). */
  savedDaily?: { kind: PuzzleKind; correct: boolean; reasonCorrect: boolean };
}

let evidence: FakeGtEvidenceService;
let learn: FakeGtLearnService;
let data: { load: ReturnType<typeof vi.fn> };

function quizStats(quizId: string, counts: Record<string, Counts>): QuizStats {
  const perTrait: Record<string, PerTraitStats> = Object.fromEntries(
    Object.entries(counts).map(([traitId, row]) => [traitId, { traitId, ...row }]),
  );
  return { quizId, version: 1, perTrait, streak: 0, roundsPlayed: 0 };
}

/** Opens the page for a kind, with the given concepts introduced and the given stats. */
function open(options: OpenOptions = {}): ComponentFixture<PuzzleSetPage> {
  evidence = new FakeGtEvidenceService();
  learn = new FakeGtLearnService();
  learn.seedIntroduced(options.introduced ?? []);
  if (options.plan) {
    learn.setPlan(options.plan);
  }
  if (options.saveFails) {
    evidence.setSaveFailed(true);
  }
  if (options.savedDaily) {
    learn.recordDailyAnswer(dateKeyOf(NOW), options.savedDaily);
  }
  const challenges = options.challenges ?? {};
  const days = options.days ?? {};
  data = {
    load: vi.fn((): Observable<GameTheoryData> => {
      if (options.checksFail) {
        return throwError(() => new Error('content down'));
      }
      return of({ ...DATA, checks: { version: 1, checks: options.checks ?? [] } });
    }),
  };
  TestBed.configureTestingModule({
    imports: [PuzzleSetPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: new BehaviorSubject(
            convertToParamMap({ kind: options.kind ?? 'equilibrium' }),
          ).asObservable(),
          queryParamMap: new BehaviorSubject(convertToParamMap(options.query ?? {})).asObservable(),
          data: of(options.daily ? { daily: true } : {}),
        },
      },
      { provide: GAME_THEORY_RNG, useValue: mulberry32(SEED) },
      { provide: APP_CLOCK, useValue: () => NOW },
      {
        provide: StatsService,
        useValue: {
          getStats: (quizId: string) =>
            quizId === 'game-theory:challenges'
              ? quizStats(quizId, challenges)
              : quizStats(quizId, {}),
        },
      },
      { provide: PracticeService, useValue: { conceptDays: () => days } },
      { provide: GameTheoryDataService, useValue: data },
      { provide: GtEvidenceService, useValue: evidence },
      { provide: GtLearnService, useValue: learn },
    ],
  });
  const fixture = TestBed.createComponent(PuzzleSetPage);
  fixture.detectChanges();
  return fixture;
}

interface Step {
  kind: PuzzleKind;
  difficulty: Difficulty;
}

/**
 * The items a set draws for a plan of kinds and difficulties, replaying the page's stream. Each
 * item avoids the matrices drawn before it in the set, as the page does.
 */
function expectedSet(plan: Step[]): Puzzle[] {
  const rng = mulberry32(SEED);
  const items: Puzzle[] = [];
  for (const step of plan) {
    const avoid = items.map((p) => matrixSignature(p.game));
    items.push(generatePuzzle(step.kind, step.difficulty, rng, { avoid }));
  }
  return items;
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) {
    throw new Error(`no element matches ${selector}`);
  }
  return found;
}

function tap(fixture: ComponentFixture<PuzzleSetPage>, selector: string): void {
  must<HTMLElement>(fixture.nativeElement, selector).click();
  fixture.detectChanges();
}

function text(fixture: ComponentFixture<PuzzleSetPage>, selector: string): string {
  return (
    must<HTMLElement>(fixture.nativeElement, selector).textContent?.replace(/\s+/g, ' ').trim() ??
    ''
  );
}

function cellsOf(payoffs: PayoffMatrix): CellRef[] {
  const cells: CellRef[] = [];
  for (let r = 0; r < payoffs.rows; r++) {
    for (let c = 0; c < payoffs.cols; c++) {
      cells.push({ r, c });
    }
  }
  return cells;
}

function equilibriumAnswer(
  fixture: ComponentFixture<PuzzleSetPage>,
  puzzle: Puzzle,
  correct: boolean,
): void {
  if (puzzle.kind !== 'equilibrium') {
    throw new Error('expected an equilibrium puzzle');
  }
  const stable = puzzle.solution;
  if (correct) {
    if (stable.length === 0) {
      tap(fixture, '[data-testid="payoff-none"]');
    }
    for (const cell of stable) {
      tap(fixture, `[data-testid="payoff-cell-${cell.r}-${cell.c}"]`);
    }
  } else {
    const off = cellsOf(puzzle.game.payoffs).find(
      (cell) => !stable.some((s) => s.r === cell.r && s.c === cell.c),
    );
    if (!off) {
      throw new Error('every cell is an equilibrium, so no wrong answer exists');
    }
    tap(fixture, `[data-testid="payoff-cell-${off.r}-${off.c}"]`);
  }
  tap(fixture, '[data-testid="puzzle-submit"]');
}

/** Answers the current item right or wrong, using the control for its kind. */
function solveItem(
  fixture: ComponentFixture<PuzzleSetPage>,
  puzzle: Puzzle,
  correct: boolean,
): void {
  if (puzzle.kind === 'equilibrium') {
    equilibriumAnswer(fixture, puzzle, correct);
    return;
  }
  if (puzzle.kind === 'classify') {
    const wrong = puzzle.choices.find((choice) => choice !== puzzle.solution) ?? puzzle.solution;
    tap(fixture, `[data-testid="puzzle-choice-${correct ? puzzle.solution : wrong}"]`);
    return;
  }
  if (!correct) {
    tap(fixture, '[data-testid="puzzle-stop"]');
    return;
  }
  for (const step of puzzle.solution) {
    tap(fixture, `[data-testid="puzzle-eliminate-${step.player}-${step.eliminated}"]`);
  }
}

/** The payoff text of each cell in DOM order, for example "3,5". */
function readout(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="payoff-cell-"]'), (cell) =>
    (cell.textContent ?? '').replace(/\s+/g, ''),
  );
}

function expectedReadout(puzzle: Puzzle): string[] {
  const { rows, cols, row, col } = puzzle.game.payoffs;
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(`${row[r][c]},${col[r][c]}`);
    }
  }
  return out;
}

describe('PuzzleSetPage (puzzles/:kind, §5.2, §5.3, §7.2, §9.1)', () => {
  describe('nothing to draw from', () => {
    it('shows the Test out empty state and no items when nothing is introduced', () => {
      const fixture = open({ introduced: [] });
      const root: HTMLElement = fixture.nativeElement;
      expect(root.textContent).toContain('Start with Best response');
      expect(
        must<HTMLAnchorElement>(root, '[data-testid="puzzles-test-out-link"]').getAttribute('href'),
      ).toBe('/game-theory/puzzles/equilibrium?solo=best-response&level=1&mode=test');
      expect(root.querySelector('[data-testid="puzzle-submit"]')).toBeNull();
      expect(root.querySelector('[data-testid="payoff-matrix"]')).toBeNull();
      expect(evidence.records).toHaveLength(0);
    });

    it('shows the same empty state for an unknown kind when nothing is introduced', () => {
      const fixture = open({ kind: 'nonsense', introduced: [] });
      const root: HTMLElement = fixture.nativeElement;
      expect(root.textContent).toContain('Start with Best response');
      expect(root.querySelector('[data-testid="puzzles-test-out-link"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="payoff-matrix"]')).toBeNull();
    });

    it('shows an unsupported state with a link to the hub for an unknown kind', () => {
      const fixture = open({ kind: 'nonsense', introduced: EQUILIBRIUM_IDS });
      const root: HTMLElement = fixture.nativeElement;
      expect(root.textContent).toContain('No puzzle set here');
      expect(
        must<HTMLAnchorElement>(root, '[data-testid="puzzles-hub-link"]').getAttribute('href'),
      ).toBe('/game-theory');
      expect(root.querySelector('[data-testid="payoff-matrix"]')).toBeNull();
    });

    it('says what is missing when the set needs ideas that are not introduced', () => {
      const fixture = open({ kind: 'equilibrium', introduced: ['best-response'] });
      const root: HTMLElement = fixture.nativeElement;
      expect(root.textContent).toContain('This set uses ideas you have not introduced yet.');
      expect(root.querySelector('[data-testid="payoff-matrix"]')).toBeNull();
    });
  });

  describe('a set of five items', () => {
    it('draws five items, each graded and recorded under challenges with its concept ids', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS });
      const items = expectedSet(
        Array.from({ length: 5 }, () => ({ kind: 'equilibrium' as const, difficulty: 1 as const })),
      );
      const root: HTMLElement = fixture.nativeElement;

      items.forEach((puzzle, index) => {
        expect(text(fixture, '[data-testid="puzzle-progress"]')).toBe(`Item ${index + 1} of 5`);
        expect(readout(root)).toEqual(expectedReadout(puzzle));
        equilibriumAnswer(fixture, puzzle, true);
        expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('Correct');
        tap(fixture, '[data-testid="puzzle-next"]');
      });

      expect(
        evidence.records.map((r) => ({
          conceptIds: r.conceptIds,
          correct: r.correct,
          facet: r.facet,
        })),
      ).toEqual(
        items.map((p) => ({ conceptIds: p.conceptIds, correct: true, facet: 'challenges' })),
      );
    });

    it('grades a wrong equilibrium answer as wrong and records it', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS });
      const [puzzle] = expectedSet([{ kind: 'equilibrium', difficulty: 1 }]);
      equilibriumAnswer(fixture, puzzle, false);
      expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('Incorrect');
      expect(evidence.records).toEqual([
        { conceptIds: puzzle.conceptIds, correct: false, facet: 'challenges' },
      ]);
    });

    it('shows the count correct after five items, and a link back to the hub', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS });
      const items = expectedSet(
        Array.from({ length: 5 }, () => ({ kind: 'equilibrium' as const, difficulty: 1 as const })),
      );
      const pattern = [true, false, true, false, true];
      items.forEach((puzzle, index) => {
        solveItem(fixture, puzzle, pattern[index]);
        tap(fixture, '[data-testid="puzzle-next"]');
      });

      expect(text(fixture, '[data-testid="puzzle-summary"]')).toBe('3 of 5 correct.');
      expect(
        must<HTMLAnchorElement>(
          fixture.nativeElement,
          '[data-testid="puzzles-hub-link"]',
        ).getAttribute('href'),
      ).toBe('/game-theory');
      expect(evidence.records).toHaveLength(5);
    });
  });

  describe('kinds', () => {
    it('classify: one button per class, graded and recorded under the true class', () => {
      const fixture = open({ kind: 'classify', introduced: CLASSIFY_IDS });
      const items = expectedSet([
        { kind: 'classify', difficulty: 1 },
        { kind: 'classify', difficulty: 1 },
      ]);
      const root: HTMLElement = fixture.nativeElement;
      const labels = Array.from(
        root.querySelectorAll<HTMLButtonElement>('[data-testid^="puzzle-choice-"]'),
        (button) => button.textContent?.trim(),
      );
      expect(labels).toEqual([
        "Prisoner's Dilemma",
        'Stag Hunt',
        'Chicken',
        'Battle of the Sexes',
        'Pure coordination',
      ]);

      solveItem(fixture, items[0], false);
      expect(evidence.records).toEqual([
        { conceptIds: items[0].conceptIds, correct: false, facet: 'challenges' },
      ]);
      tap(fixture, '[data-testid="puzzle-next"]');

      solveItem(fixture, items[1], true);
      expect(evidence.records[1]).toEqual({
        conceptIds: items[1].conceptIds,
        correct: true,
        facet: 'challenges',
      });
    });

    it('classify: shows the payoff matrix read-only, with how to read a cell', () => {
      const fixture = open({ kind: 'classify', introduced: CLASSIFY_IDS });
      const root: HTMLElement = fixture.nativeElement;

      expect(root.querySelectorAll('[data-testid^="payoff-cell-"]')).toHaveLength(4);
      expect(must<HTMLElement>(root, '[data-testid="puzzle-matrix-readonly"]').hasAttribute('inert')).toBe(true);
      expect(root.textContent).toContain("Each cell shows the row player's payoff, then the column player's");
      // The equilibrium-only controls do not belong to a classify item.
      expect(root.querySelector('[data-testid="payoff-none"]')).toBeNull();
      expect(root.querySelectorAll('[data-testid="puzzle-matrix-readonly"] p')).toHaveLength(0);
    });

    it('classify: shows a difficulty 3 item\'s cover story, which is the setting it describes', () => {
      const fixture = open({
        kind: 'classify',
        introduced: CLASSIFY_IDS,
        query: { solo: 'prisoners-dilemma', level: '3', mode: 'tutorial' },
      });
      const [puzzle] = expectedSet([{ kind: 'classify', difficulty: 3 }]);
      expect(puzzle.game.story).toEqual(expect.any(String));

      expect(text(fixture, '[data-testid="puzzle-story"]')).toBe(puzzle.game.story);
    });

    it('eliminate: offers the legal eliminations as buttons, and finishing grades it correct', () => {
      const fixture = open({ kind: 'eliminate', introduced: ELIMINATE_IDS });
      const [puzzle] = expectedSet([{ kind: 'eliminate', difficulty: 1 }]);
      if (puzzle.kind !== 'eliminate') {
        throw new Error('expected an elimination puzzle');
      }
      const first = puzzle.solution[0];
      const buttonFor = `[data-testid="puzzle-eliminate-${first.player}-${first.eliminated}"]`;
      expect(fixture.nativeElement.querySelector(buttonFor)).not.toBeNull();

      tap(fixture, buttonFor);
      expect(text(fixture, '[data-testid="payoff-matrix"]')).toContain('Eliminated (step 1)');

      for (const step of puzzle.solution.slice(1)) {
        tap(fixture, `[data-testid="puzzle-eliminate-${step.player}-${step.eliminated}"]`);
      }
      expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('Correct');
      expect(evidence.records).toEqual([
        {
          conceptIds: ['dominant-strategy', 'iterated-elimination'],
          correct: true,
          facet: 'challenges',
        },
      ]);
    });

    it('eliminate: offers every strategy still in the game, so recognising dominance matters', () => {
      const fixture = open({ kind: 'eliminate', introduced: ELIMINATE_IDS });
      const [puzzle] = expectedSet([{ kind: 'eliminate', difficulty: 1 }]);
      if (puzzle.kind !== 'eliminate') {
        throw new Error('expected an elimination puzzle');
      }
      const { rows, cols } = puzzle.game.payoffs;

      for (let r = 0; r < rows; r++) {
        expect(fixture.nativeElement.querySelector(`[data-testid="puzzle-eliminate-row-${r}"]`)).not.toBeNull();
      }
      for (let c = 0; c < cols; c++) {
        expect(fixture.nativeElement.querySelector(`[data-testid="puzzle-eliminate-col-${c}"]`)).not.toBeNull();
      }
    });

    it('eliminate: removing a strategy that is not dominated grades the item incorrect at once', () => {
      const fixture = open({ kind: 'eliminate', introduced: ELIMINATE_IDS });
      const [puzzle] = expectedSet([{ kind: 'eliminate', difficulty: 1 }]);
      if (puzzle.kind !== 'eliminate') {
        throw new Error('expected an elimination puzzle');
      }
      // A strategy that is left after every legal removal is never dominated, so it is not legal now.
      const survives = (player: 'row' | 'col', index: number) =>
        !puzzle.solution.some((step) => step.player === player && step.eliminated === index);
      const count = (player: 'row' | 'col') =>
        player === 'row' ? puzzle.game.payoffs.rows : puzzle.game.payoffs.cols;
      const pick = (['row', 'col'] as const)
        .flatMap((player) => Array.from({ length: count(player) }, (_, index) => ({ player, index })))
        .find((move) => survives(move.player, move.index));
      if (!pick) {
        throw new Error('every strategy is removed, so no survivor exists');
      }

      tap(fixture, `[data-testid="puzzle-eliminate-${pick.player}-${pick.index}"]`);
      expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('Incorrect');
      expect(evidence.records).toEqual([
        {
          conceptIds: ['dominant-strategy', 'iterated-elimination'],
          correct: false,
          facet: 'challenges',
        },
      ]);
    });

    it('eliminate: stopping while a strategy is still dominated grades it incorrect', () => {
      const fixture = open({ kind: 'eliminate', introduced: ELIMINATE_IDS });
      expectedSet([{ kind: 'eliminate', difficulty: 1 }]);
      tap(fixture, '[data-testid="puzzle-stop"]');
      expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('You stopped early');
      expect(evidence.records).toEqual([
        {
          conceptIds: ['dominant-strategy', 'iterated-elimination'],
          correct: false,
          facet: 'challenges',
        },
      ]);
    });

    it('mixed: interleaves the three kinds across the set', () => {
      const introduced = [...EQUILIBRIUM_IDS, ...CLASSIFY_IDS, ...ELIMINATE_IDS];
      const fixture = open({ kind: 'mixed', introduced });
      const plan: Step[] = [
        { kind: 'equilibrium', difficulty: 1 },
        { kind: 'classify', difficulty: 1 },
        { kind: 'eliminate', difficulty: 1 },
        { kind: 'equilibrium', difficulty: 1 },
        { kind: 'classify', difficulty: 1 },
      ];
      const items = expectedSet(plan);
      const kindLabels = ['Equilibrium', 'Classify', 'Eliminate', 'Equilibrium', 'Classify'];
      items.forEach((puzzle, index) => {
        expect(text(fixture, '[data-testid="puzzle-kind"]')).toBe(kindLabels[index]);
        solveItem(fixture, puzzle, true);
        tap(fixture, '[data-testid="puzzle-next"]');
      });
      expect(text(fixture, '[data-testid="puzzle-summary"]')).toBe('5 of 5 correct.');
    });
  });

  describe('difficulty gating (§7.2)', () => {
    it('holds a difficulty-2 item back when nash-equilibrium is not Practised', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS });
      const items = expectedSet([
        { kind: 'equilibrium', difficulty: 1 },
        { kind: 'equilibrium', difficulty: 1 },
      ]);
      equilibriumAnswer(fixture, items[0], true);
      tap(fixture, '[data-testid="puzzle-next"]');

      expect(text(fixture, '[data-testid="puzzle-difficulty"]')).toBe('Difficulty 1');
      expect(text(fixture, '[data-testid="puzzle-held-back"]')).toContain(
        'difficulty 2 needs Nash equilibrium Practised',
      );
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(items[1]));
    });

    it('draws a difficulty-2 item once nash-equilibrium is Practised', () => {
      const fixture = open({
        introduced: EQUILIBRIUM_IDS,
        challenges: { 'nash-equilibrium': { attempted: 4, correct: 3 } },
      });
      const items = expectedSet([
        { kind: 'equilibrium', difficulty: 1 },
        { kind: 'equilibrium', difficulty: 2 },
      ]);
      equilibriumAnswer(fixture, items[0], true);
      tap(fixture, '[data-testid="puzzle-next"]');

      expect(text(fixture, '[data-testid="puzzle-difficulty"]')).toBe('Difficulty 2');
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-held-back"]')).toBeNull();
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(items[1]));
    });

    it('holds a difficulty-3 item at 2 when nash-equilibrium is Practised but not Mastered', () => {
      const fixture = open({
        introduced: EQUILIBRIUM_IDS,
        challenges: { 'nash-equilibrium': { attempted: 4, correct: 3 } },
      });
      const items = expectedSet([
        { kind: 'equilibrium', difficulty: 1 },
        { kind: 'equilibrium', difficulty: 2 },
        { kind: 'equilibrium', difficulty: 2 },
      ]);
      equilibriumAnswer(fixture, items[0], true);
      tap(fixture, '[data-testid="puzzle-next"]');
      equilibriumAnswer(fixture, items[1], true);
      tap(fixture, '[data-testid="puzzle-next"]');

      expect(text(fixture, '[data-testid="puzzle-difficulty"]')).toBe('Difficulty 2');
      expect(text(fixture, '[data-testid="puzzle-held-back"]')).toContain(
        'difficulty 3 needs Nash equilibrium Mastered',
      );
    });

    it('draws a difficulty-3 item once nash-equilibrium is Mastered', () => {
      const fixture = open({
        introduced: EQUILIBRIUM_IDS,
        challenges: { 'nash-equilibrium': { attempted: 10, correct: 9 } },
        days: { 'nash-equilibrium': { days: 2, lastDay: '2026-11-02' } },
      });
      const items = expectedSet([
        { kind: 'equilibrium', difficulty: 1 },
        { kind: 'equilibrium', difficulty: 2 },
        { kind: 'equilibrium', difficulty: 3 },
      ]);
      equilibriumAnswer(fixture, items[0], true);
      tap(fixture, '[data-testid="puzzle-next"]');
      equilibriumAnswer(fixture, items[1], true);
      tap(fixture, '[data-testid="puzzle-next"]');

      expect(text(fixture, '[data-testid="puzzle-difficulty"]')).toBe('Difficulty 3');
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-held-back"]')).toBeNull();
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(items[2]));
    });

    it('holds a 3x3 elimination item back until dominant-strategy is Practised', () => {
      const fixture = open({ kind: 'eliminate', introduced: ELIMINATE_IDS });
      const items = expectedSet([
        { kind: 'eliminate', difficulty: 1 },
        { kind: 'eliminate', difficulty: 1 },
      ]);
      solveItem(fixture, items[0], true);
      tap(fixture, '[data-testid="puzzle-next"]');

      expect(text(fixture, '[data-testid="puzzle-difficulty"]')).toBe('Difficulty 1');
      expect(text(fixture, '[data-testid="puzzle-held-back"]')).toContain(
        'Dominant strategy Practised',
      );
    });
  });

  describe('reason checks (§5.3)', () => {
    it('shows a matching reason check after the item, and records its answer separately', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS, checks: [NASH_CHECK] });
      const [puzzle] = expectedSet([{ kind: 'equilibrium', difficulty: 1 }]);

      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-reason-check"]')).toBeNull();
      equilibriumAnswer(fixture, puzzle, true);
      expect(text(fixture, '[data-testid="puzzle-reason-check"]')).toContain(NASH_CHECK.prompt);
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-next"]')).toBeNull();

      tap(fixture, '[data-testid="puzzle-reason-option-b"]');
      expect(text(fixture, '[data-testid="puzzle-reason-check"]')).toContain(
        'Stable is not the same as best.',
      );
      expect(evidence.records).toEqual([
        { conceptIds: puzzle.conceptIds, correct: true, facet: 'challenges' },
        { conceptIds: ['nash-equilibrium'], correct: false, facet: 'challenges' },
      ]);
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-next"]')).not.toBeNull();
    });

    it('records a correct reason as correct', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS, checks: [NASH_CHECK] });
      const [puzzle] = expectedSet([{ kind: 'equilibrium', difficulty: 1 }]);
      equilibriumAnswer(fixture, puzzle, true);
      tap(fixture, '[data-testid="puzzle-reason-option-a"]');
      expect(evidence.records[1]).toEqual({
        conceptIds: ['nash-equilibrium'],
        correct: true,
        facet: 'challenges',
      });
    });

    it('shows no reason check when no check matches the item, and says nothing about it', () => {
      const fixture = open({
        introduced: EQUILIBRIUM_IDS,
        checks: [
          ELIMINATE_CHECK,
          { ...NASH_CHECK, context: 'bots' },
          { ...NASH_CHECK, conceptId: 'chicken-game' },
        ],
      });
      const [puzzle] = expectedSet([{ kind: 'equilibrium', difficulty: 1 }]);
      equilibriumAnswer(fixture, puzzle, true);

      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-reason-check"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-next"]')).not.toBeNull();
      expect(evidence.records).toHaveLength(1);
    });

    it('still draws items when the checks do not load, and says that no reason will be asked', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS, checksFail: true });
      const [puzzle] = expectedSet([{ kind: 'equilibrium', difficulty: 1 }]);
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(puzzle));
      equilibriumAnswer(fixture, puzzle, true);
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-reason-check"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain("Reason checks couldn't load");
    });
  });

  describe('solo mode (spec §7.1, §7.2)', () => {
    const SOLO = { solo: 'best-response', level: '2', mode: 'tutorial' };
    const TEST = { solo: 'best-response', level: '1', mode: 'test' };

    it('says what passing a tutorial solo takes', () => {
      const fixture = open({ introduced: ['best-response'], query: SOLO });

      expect(text(fixture, '[data-testid="puzzle-solo-note"]')).toContain('two right of three passes this idea');
    });

    it('says what a test-out takes', () => {
      const fixture = open({ query: TEST });

      expect(text(fixture, '[data-testid="puzzle-solo-note"]')).toContain('all three right tests this idea out');
    });

    it('draws three items at the level it is given, with no gate and no reason check', () => {
      const fixture = open({ introduced: [], query: SOLO });
      const items = expectedSet(
        Array.from({ length: 3 }, () => ({ kind: 'equilibrium' as const, difficulty: 2 as const })),
      );

      expect(text(fixture, '[data-testid="puzzle-progress"]')).toBe('Item 1 of 3');
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(items[0]));
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-reason"]')).toBeNull();
    });

    it('a classify solo set draws only its concept\'s class, so every item tests and credits that concept', () => {
      const fixture = open({
        kind: 'classify',
        introduced: CLASSIFY_IDS,
        query: { solo: 'prisoners-dilemma', level: '1', mode: 'tutorial' },
      });

      for (let i = 0; i < 3; i++) {
        tap(fixture, '[data-testid="puzzle-choice-prisoners-dilemma"]');
        expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('Correct');
        tap(fixture, '[data-testid="puzzle-next"]');
      }
      expect(evidence.records).toEqual(
        Array.from({ length: 3 }, () => ({
          conceptIds: ['prisoners-dilemma'],
          correct: true,
          facet: 'challenges',
        })),
      );
    });

    it('draws a test-out set even though its concept is not introduced yet', () => {
      const fixture = open({ introduced: [], query: TEST });

      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-empty"]')).toBeNull();
      expect(text(fixture, '[data-testid="puzzle-progress"]')).toBe('Item 1 of 3');
    });

    it('a tutorial solo that passes at two records stage 3', () => {
      const fixture = open({ introduced: ['best-response'], query: SOLO });
      const items = expectedSet(
        Array.from({ length: 3 }, () => ({ kind: 'equilibrium' as const, difficulty: 2 as const })),
      );
      items.forEach((puzzle, index) => {
        solveItem(fixture, puzzle, index !== 2);
        tap(fixture, '[data-testid="puzzle-next"]');
      });

      expect(text(fixture, '[data-testid="puzzle-solo-result"]')).toContain('passed');
      expect(learn.read().concepts['best-response']?.stage).toBe(3);
      expect(learn.read().concepts['best-response']?.testedOut).toBe(false);
    });

    it('a tutorial solo under two does not record stage 3, and offers a fresh set', () => {
      const fixture = open({ introduced: ['best-response'], query: SOLO });
      const items = expectedSet(
        Array.from({ length: 3 }, () => ({ kind: 'equilibrium' as const, difficulty: 2 as const })),
      );
      items.forEach((puzzle, index) => {
        solveItem(fixture, puzzle, index === 0);
        tap(fixture, '[data-testid="puzzle-next"]');
      });

      expect(text(fixture, '[data-testid="puzzle-solo-result"]')).toContain('not passed');
      expect(learn.read().concepts['best-response']?.stage).toBe(2);
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-fresh-set"]')).not.toBeNull();
    });

    it('a test-out records the concept as tested out only when all three pass', () => {
      const fixture = open({ introduced: [], query: TEST });
      const items = expectedSet(
        Array.from({ length: 3 }, () => ({ kind: 'equilibrium' as const, difficulty: 1 as const })),
      );
      items.forEach((puzzle, index) => {
        solveItem(fixture, puzzle, index !== 1);
        tap(fixture, '[data-testid="puzzle-next"]');
      });

      expect(learn.read().concepts['best-response']).toBeUndefined();
      expect(text(fixture, '[data-testid="puzzle-solo-result"]')).toContain('not passed');
    });
  });

  describe('daily puzzle (spec §9.2)', () => {
    const TODAY = dateKeyOf(NOW);
    const BOTH = ['best-response', 'nash-equilibrium'];

    /** The first puzzle the daily draws from its day stream that credits only introduced concepts. */
    function firstIntroduced(difficulty: Difficulty, introduced: string[]): Puzzle {
      const rng = dailyRng(TODAY);
      for (let i = 0; i < 100; i++) {
        const puzzle = generatePuzzle('equilibrium', difficulty, rng);
        if (puzzle.conceptIds.every((id) => introduced.includes(id))) return puzzle;
      }
      throw new Error('no introduced puzzle in 100 draws');
    }

    it('is one item of the kind the plan gives, drawn from the day stream', () => {
      const fixture = open({ daily: true, introduced: BOTH });

      expect(text(fixture, '[data-testid="puzzle-progress"]')).toBe('Item 1 of 1');
      expect(learn.plan()).toMatchObject({ kind: 'equilibrium', difficulty: 1, dateKey: TODAY });
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(firstIntroduced(1, BOTH)));
    });

    it('keeps the stored plan when mastery changes later in the day', () => {
      const plan: DailyPlan = {
        version: 1,
        dateKey: TODAY,
        kind: 'equilibrium',
        difficulty: 1,
        seedKey: 'gt-daily/v1/' + TODAY,
      };
      const fixture = open({
        daily: true,
        introduced: BOTH,
        plan,
        challenges: { 'nash-equilibrium': { attempted: 8, correct: 8 } },
        days: { 'nash-equilibrium': { days: 2, lastDay: TODAY } },
      });

      expect(learn.plan()?.difficulty).toBe(1);
      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(firstIntroduced(1, BOTH)));
    });

    it('scores the answer, records it as the day answer, and makes the day a practice day', () => {
      const fixture = open({ daily: true, introduced: BOTH });
      solveItem(fixture, firstIntroduced(1, BOTH), true);

      expect(evidence.records.map((r) => r.facet)).toEqual(['challenges']);
      expect(evidence.dailyCalls).toHaveLength(1);
      expect(learn.read().daily[TODAY]).toEqual({
        kind: 'equilibrium',
        correct: true,
        reasonCorrect: false,
      });
    });

    it('shows that the daily is done, and that another comes tomorrow', () => {
      const fixture = open({ daily: true, introduced: BOTH });
      solveItem(fixture, firstIntroduced(1, BOTH), true);
      tap(fixture, '[data-testid="puzzle-next"]');

      expect(text(fixture, '[data-testid="puzzle-summary"]')).toContain('1 of 1 correct');
      expect(fixture.nativeElement.textContent).toContain('Come back tomorrow');
    });

    it('asks no equilibrium reason check when the item has no pure equilibrium, as there is no stable cell to ask about', () => {
      const plan: DailyPlan = {
        version: 1,
        dateKey: TODAY,
        kind: 'equilibrium',
        difficulty: 2,
        seedKey: 'gt-daily/v1/' + TODAY,
      };
      const fixture = open({ daily: true, introduced: BOTH, plan, checks: [NASH_CHECK] });
      const puzzle = firstIntroduced(2, BOTH);
      expect(puzzle).toMatchObject({ kind: 'equilibrium', solution: [] });

      expect(readout(fixture.nativeElement)).toEqual(expectedReadout(puzzle));
      equilibriumAnswer(fixture, puzzle, true);
      expect(text(fixture, '[data-testid="puzzle-feedback"]')).toContain('No cell is stable');
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-reason-check"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-next"]')).not.toBeNull();
    });

    it('a reopened daily shows today\'s saved answer, and offers no second answer', () => {
      const saved = { kind: 'equilibrium' as const, correct: false, reasonCorrect: false };
      const fixture = open({ daily: true, introduced: BOTH, savedDaily: saved });

      expect(text(fixture, '[data-testid="puzzle-summary"]')).toContain('0 of 1 correct');
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-submit"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-progress"]')).toBeNull();
      expect(evidence.records).toEqual([]);
      expect(learn.read().daily[TODAY]).toEqual(saved);
    });

    it('is locked until nash-equilibrium is introduced', () => {
      const fixture = open({ daily: true, introduced: [] });

      expect(fixture.nativeElement.textContent).toContain('Unlocks after your first tutorial.');
      expect(fixture.nativeElement.querySelector('[data-testid="puzzle-progress"]')).toBeNull();
    });
  });

  describe('page shell and saving', () => {
    it('renders one h1 inside a ui-page-shell, titled with the set name', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS });
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('ui-page-shell')).not.toBeNull();
      const headings = root.querySelectorAll('h1');
      expect(headings).toHaveLength(1);
      expect(headings[0].textContent?.trim()).toBe('Equilibrium puzzles');
    });

    it('shows the write-failure message when a save fails', () => {
      const fixture = open({ introduced: EQUILIBRIUM_IDS, saveFails: true });
      expect(fixture.nativeElement.textContent).toContain(
        "Progress can't be saved in this browser.",
      );
    });
  });
});
