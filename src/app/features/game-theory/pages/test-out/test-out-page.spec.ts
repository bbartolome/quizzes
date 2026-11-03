import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { TestOutPage } from './test-out-page';
import { GameTheoryData, GameTheoryDataService } from '../../data/game-theory-data.service';
import { generatePuzzle } from '../../lib/puzzles';
import type { CellRef, PayoffMatrix } from '../../lib/matrix.types';
import type { Puzzle } from '../../lib/puzzle.types';
import { mulberry32 } from '../../lib/rng';
import { GAME_THEORY_RNG } from '../../state/gt-tokens';
import { GtEvidenceService } from '../../state/gt-evidence.service';
import { GtLearnService } from '../../state/gt-learn.service';
import { APP_CLOCK } from '../../../../core/app-clock';
import type { GameTheoryConcept } from '../../../../core/models/quiz.models';
import { FakeGtEvidenceService } from '../../../../../testing/fake-gt-evidence.service';

// A fixed seed makes the three items of a set deterministic. expectedItems() replays the same
// stream, so a test can answer each item correctly or wrongly.
const SEED = 20260101;
const NOW = new Date('2026-11-03T12:00:00Z');

function concept(id: string, name: string): GameTheoryConcept {
  return {
    id,
    name,
    type: 'game-theory',
    shortDefinition: '',
    longExplanation: '',
    example: '',
    tier: 1,
    prerequisites: [],
    modes: ['equilibrium'],
  };
}

const DATA: GameTheoryData = {
  concepts: {
    version: 1,
    concepts: [
      concept('best-response', 'Best response'),
      concept('nash-equilibrium', 'Nash equilibrium'),
      concept('chicken-game', 'Chicken game'),
    ],
    pairs: [],
  },
  tutorials: { version: 1, tutorials: [] },
  checks: { version: 1, checks: [] },
};

let evidence: FakeGtEvidenceService;
let learn: { testOut: ReturnType<typeof vi.fn> };
let data: { load: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> };

/** Opens the page on a concept id. With contentFails, the content load errors until retry. */
function open(conceptId: string, contentFails = false): ComponentFixture<TestOutPage> {
  evidence = new FakeGtEvidenceService();
  learn = { testOut: vi.fn(() => true) };
  data = {
    load: vi.fn(() => (contentFails ? throwError(() => new Error('content down')) : of(DATA))),
    retry: vi.fn((): Observable<GameTheoryData> => of(DATA)),
  };
  TestBed.configureTestingModule({
    imports: [TestOutPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ concept: conceptId })).asObservable(),
        },
      },
      { provide: GAME_THEORY_RNG, useValue: mulberry32(SEED) },
      { provide: APP_CLOCK, useValue: () => NOW },
      { provide: GameTheoryDataService, useValue: data },
      { provide: GtEvidenceService, useValue: evidence },
      { provide: GtLearnService, useValue: learn },
    ],
  });
  const fixture = TestBed.createComponent(TestOutPage);
  fixture.detectChanges();
  return fixture;
}

/** The first n items the page draws from the seeded stream, in order. */
function expectedItems(count: number): Puzzle[] {
  const rng = mulberry32(SEED);
  return Array.from({ length: count }, () => generatePuzzle('equilibrium', 1, rng));
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) {
    throw new Error(`no element matches ${selector}`);
  }
  return found;
}

function tap(fixture: ComponentFixture<TestOutPage>, selector: string): void {
  must<HTMLElement>(fixture.nativeElement, selector).click();
  fixture.detectChanges();
}

function solutionOf(puzzle: Puzzle): CellRef[] {
  if (puzzle.kind !== 'equilibrium') {
    throw new Error('expected an equilibrium puzzle');
  }
  return puzzle.solution;
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

/** Picks the cells for a right answer, or a non-equilibrium cell for a wrong one, then submits. */
function answer(fixture: ComponentFixture<TestOutPage>, puzzle: Puzzle, correct: boolean): void {
  const stable = solutionOf(puzzle);
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
  tap(fixture, '[data-testid="test-out-submit"]');
}

/** The payoff text of each cell in DOM order, with whitespace removed, for example "3,5". */
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

describe('TestOutPage (test-out, §7.1)', () => {
  it('shows the No test state for an idea with no test, and links back to the hub', () => {
    const fixture = open('chicken-game');
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('No test for this idea yet');
    expect(root.querySelector('[data-testid="payoff-matrix"]')).toBeNull();
    expect(
      must<HTMLAnchorElement>(root, '[data-testid="test-out-hub-link"]').getAttribute('href'),
    ).toBe('/game-theory');
  });

  it('calls testOut with the concept id and records three challenge items after a 3 of 3 run', () => {
    const fixture = open('best-response');
    const items = expectedItems(3);
    items.forEach((puzzle, index) => {
      answer(fixture, puzzle, true);
      if (index < 2) {
        tap(fixture, '[data-testid="test-out-next"]');
      }
    });

    expect(learn.testOut).toHaveBeenCalledTimes(1);
    expect(learn.testOut).toHaveBeenCalledWith('best-response');
    expect(evidence.records).toHaveLength(3);
    expect(evidence.records.every((r) => r.facet === 'challenges' && r.correct)).toBe(true);
    expect(evidence.records.map((r) => r.conceptIds)).toEqual(items.map((p) => p.conceptIds));
    expect(fixture.nativeElement.textContent).toContain('You have tested out of Best response');
  });

  it('does not call testOut after a wrong item, and starts a fresh set of three new items', () => {
    const fixture = open('best-response');
    const items = expectedItems(6);
    answer(fixture, items[0], true);
    tap(fixture, '[data-testid="test-out-next"]');
    answer(fixture, items[1], false);
    tap(fixture, '[data-testid="test-out-next"]');
    answer(fixture, items[2], true);

    expect(learn.testOut).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Not yet. Try a fresh set.');

    tap(fixture, '[data-testid="test-out-fresh-set"]');
    const root: HTMLElement = fixture.nativeElement;
    for (const puzzle of items.slice(3)) {
      expect(readout(root)).toEqual(expectedReadout(puzzle));
      answer(fixture, puzzle, true);
      if (puzzle !== items[5]) {
        tap(fixture, '[data-testid="test-out-next"]');
      }
    }
    expect(evidence.records).toHaveLength(6);
  });

  it('renders one h1 inside a ui-page-shell, titled with the concept name from the content', () => {
    const fixture = open('best-response');
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('ui-page-shell')).not.toBeNull();
    const headings = root.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.trim()).toBe('Best response');
  });

  it('shows no best-response underlines on a fresh item, so the test gives no hints', () => {
    const fixture = open('best-response');
    expect(fixture.nativeElement.querySelectorAll('.underline')).toHaveLength(0);
  });

  it("shows Couldn't load with Retry when the content fails, and retry loads the test", () => {
    const fixture = open('best-response', true);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain("Couldn't load");
    expect(root.querySelector('[data-testid="payoff-matrix"]')).toBeNull();

    tap(fixture, '[data-testid="test-out-retry"]');
    expect(data.retry).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-testid="payoff-matrix"]')).not.toBeNull();
  });
});
