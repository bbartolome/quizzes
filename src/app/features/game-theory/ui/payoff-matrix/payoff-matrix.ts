import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { CellRef, PayoffMatrix } from '../../lib/matrix.types';
import { OUTCOME_LOOK, type Outcome } from '../../../../shared/ui/outcome-look';
import { SELECTED_LOOK, type OptionRowState } from '../../../../shared/ui/option-row';
import { StatusBadge, type BadgeTone } from '../../../../shared/ui/status-badge';

/** Best-response flags in the shape lib/matrix.ts bestResponseMarks returns. Defined here so the widget does not import the solver. */
export interface BestResponseMarks {
  /** row[r][c]: r is a best response for the row player to column c. */
  row: boolean[][];
  /** col[r][c]: c is a best response for the column player to row r. */
  col: boolean[][];
}

/** A struck-out row or column. The page derives it from EliminationStep[]. `step` is the number shown to the player. */
export interface EliminatedLine {
  player: 'row' | 'col';
  index: number;
  step: number;
}

/** The grades this widget shows. Neutral is left to other widgets. */
export type CellOutcome = Exclude<Outcome, 'neutral'>;

/** A grade for one cell, by matrix position. */
export interface CellGrade extends CellRef {
  outcome: CellOutcome;
}

const CELL_BASE =
  'flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg border p-2 text-sm cursor-pointer focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface';

// Mirrors the state table in option-row.ts, which is private there. SELECTED_LOOK is shared as exported.
const STATE_LOOK: Record<OptionRowState, string> = {
  idle: 'border-default',
  neutral: 'border-default',
  selected: SELECTED_LOOK,
  correct: 'border-success bg-success-subtle',
  wrong: 'border-danger bg-danger-subtle',
  missed: 'border-warning bg-warning-subtle',
};

const WORD: Record<CellOutcome, string> = { correct: 'Correct', wrong: 'Wrong', missed: 'Missed' };

interface StatusView {
  tone: BadgeTone;
  label: string;
}

interface CellView {
  r: number;
  c: number;
  testId: string;
  label: string;
  rowPayoff: number;
  colPayoff: number;
  rowBest: boolean;
  colBest: boolean;
  pressed: boolean;
  classes: string;
  status: StatusView | null;
}

interface LineView {
  index: number;
  label: string;
  /** "Eliminated (step N)" when struck out, otherwise null. */
  note: string | null;
}

interface RowView {
  line: LineView;
  cells: CellView[];
}

const range = (count: number): number[] => Array.from({ length: count }, (_, index) => index);
const keyOf = (r: number, c: number): string => `${r}:${c}`;

function lineViews(
  count: number,
  labels: string[],
  player: EliminatedLine['player'],
  eliminated: EliminatedLine[],
): LineView[] {
  return range(count).map((index) => {
    const hit = eliminated.find((line) => line.player === player && line.index === index);
    return {
      index,
      label: labels[index] ?? '',
      note: hit ? `Eliminated (step ${hit.step})` : null,
    };
  });
}

/** A grade wins over a plain pick, and a plain pick wins over idle. */
function stateOf(outcome: CellOutcome | null, pressed: boolean): OptionRowState {
  if (outcome) {
    return OUTCOME_LOOK[outcome].state;
  }
  return pressed ? 'selected' : 'idle';
}

function statusFor(outcome: CellOutcome | null, pressed: boolean): StatusView | null {
  if (outcome) {
    return { tone: OUTCOME_LOOK[outcome].tone, label: WORD[outcome] };
  }
  return pressed ? { tone: 'neutral', label: 'Selected' } : null;
}

/** The accessible name. It carries the payoffs and best responses the button text shows, plus any grade word. */
function cellName(
  rowLabel: string,
  colLabel: string,
  r: number,
  c: number,
  rowPayoff: number,
  colPayoff: number,
  rowBest: boolean,
  colBest: boolean,
  outcome: CellOutcome | null,
): string {
  const parts = [
    `Row ${rowLabel}, column ${colLabel}: row ${r + 1}, column ${c + 1}`,
    `row payoff ${rowPayoff}, column payoff ${colPayoff}`,
  ];
  if (rowBest) {
    parts.push('row best response');
  }
  if (colBest) {
    parts.push('column best response');
  }
  if (outcome) {
    parts.push(WORD[outcome]);
  }
  return parts.join(', ');
}

/**
 * A pure, presentational payoff matrix. It takes the solver's outputs as inputs and does not solve.
 * The selection is two-way bindable: `[(selected)]` and `[(noneChosen)]`. Grades come from the page.
 */
@Component({
  selector: 'app-payoff-matrix',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payoff-matrix.html',
  imports: [StatusBadge],
})
export class PayoffMatrixWidget {
  readonly matrix = input.required<PayoffMatrix>();
  readonly rowLabels = input.required<string[]>();
  readonly colLabels = input.required<string[]>();
  readonly bestResponseMarks = input.required<BestResponseMarks>();
  readonly eliminated = input<EliminatedLine[]>([]);
  readonly cellGrades = input<CellGrade[]>([]);
  readonly noneGrade = input<CellOutcome | null>(null);

  /** The cells the player has picked. Picking a cell clears "None". */
  readonly selected = model<CellRef[]>([]);
  /** The "None of these" pick. Picking None clears the cells. */
  readonly noneChosen = model<boolean>(false);

  protected readonly colHeads = computed(() =>
    lineViews(this.matrix().cols, this.colLabels(), 'col', this.eliminated()),
  );

  protected readonly rows = computed<RowView[]>(() => {
    const m = this.matrix();
    const marks = this.bestResponseMarks();
    const rowLabels = this.rowLabels();
    const colLabels = this.colLabels();
    const grades = new Map(this.cellGrades().map((g) => [keyOf(g.r, g.c), g.outcome] as const));
    const picked = new Set(this.selected().map((p) => keyOf(p.r, p.c)));

    return lineViews(m.rows, rowLabels, 'row', this.eliminated()).map((line) => ({
      line,
      cells: range(m.cols).map((c) => {
        const r = line.index;
        const key = keyOf(r, c);
        const outcome = grades.get(key) ?? null;
        const pressed = picked.has(key);
        const rowPayoff = m.row[r][c];
        const colPayoff = m.col[r][c];
        const rowBest = marks.row[r][c];
        const colBest = marks.col[r][c];
        const state = stateOf(outcome, pressed);
        return {
          r,
          c,
          testId: `payoff-cell-${r}-${c}`,
          label: cellName(
            rowLabels[r] ?? '',
            colLabels[c] ?? '',
            r,
            c,
            rowPayoff,
            colPayoff,
            rowBest,
            colBest,
            outcome,
          ),
          rowPayoff,
          colPayoff,
          rowBest,
          colBest,
          pressed,
          classes: `${CELL_BASE} ${STATE_LOOK[state]}`,
          status: statusFor(outcome, pressed),
        };
      }),
    }));
  });

  protected readonly none = computed(() => {
    const grade = this.noneGrade();
    const pressed = this.noneChosen();
    return {
      classes: `${CELL_BASE} ${STATE_LOOK[stateOf(grade, pressed)]}`,
      status: statusFor(grade, pressed),
    };
  });

  protected toggleCell(r: number, c: number): void {
    const picked = this.selected();
    const isOn = picked.some((p) => p.r === r && p.c === c);
    this.noneChosen.set(false);
    this.selected.set(isOn ? picked.filter((p) => p.r !== r || p.c !== c) : [...picked, { r, c }]);
  }

  protected toggleNone(): void {
    if (this.noneChosen()) {
      this.noneChosen.set(false);
      return;
    }
    this.selected.set([]);
    this.noneChosen.set(true);
  }
}
