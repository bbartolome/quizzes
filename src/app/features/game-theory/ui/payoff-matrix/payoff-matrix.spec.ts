import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { PayoffMatrix } from '../../lib/matrix.types';
import {
  PayoffMatrixWidget,
  type BestResponseMarks,
  type CellGrade,
  type CellOutcome,
  type EliminatedLine,
} from './payoff-matrix';

// A 3x3 game with a pure equilibrium on the diagonal. The marks are the diagonal, which is
// what bestResponseMarks returns for this matrix. The widget does not check them.
const LABELS = ['Price cut', 'Hold', 'Advertise'];

const MATRIX: PayoffMatrix = {
  rows: 3,
  cols: 3,
  row: [
    [4, 1, 0],
    [3, 2, 1],
    [1, 0, 2],
  ],
  col: [
    [4, 3, 1],
    [1, 2, 0],
    [0, 1, 2],
  ],
};

const MARKS: BestResponseMarks = {
  row: [
    [true, false, false],
    [false, true, false],
    [false, false, true],
  ],
  col: [
    [true, false, false],
    [false, true, false],
    [false, false, true],
  ],
};

const COLOUR_UTILITY = /^(text|bg|decoration|border|ring|fill|outline)-/;

interface RenderOptions {
  eliminated?: EliminatedLine[];
  cellGrades?: CellGrade[];
  noneGrade?: CellOutcome | null;
}

function render(options: RenderOptions = {}) {
  TestBed.configureTestingModule({ imports: [PayoffMatrixWidget] });
  const fixture = TestBed.createComponent(PayoffMatrixWidget);
  fixture.componentRef.setInput('matrix', MATRIX);
  fixture.componentRef.setInput('rowLabels', LABELS);
  fixture.componentRef.setInput('colLabels', LABELS);
  fixture.componentRef.setInput('bestResponseMarks', MARKS);
  fixture.componentRef.setInput('eliminated', options.eliminated ?? []);
  fixture.componentRef.setInput('cellGrades', options.cellGrades ?? []);
  fixture.componentRef.setInput('noneGrade', options.noneGrade ?? null);
  fixture.detectChanges();
  return fixture;
}

function root(fixture: { nativeElement: unknown }): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function cell(el: HTMLElement, r: number, c: number): HTMLButtonElement {
  const found = el.querySelector<HTMLButtonElement>(`[data-testid="payoff-cell-${r}-${c}"]`);
  if (!found) {
    throw new Error(`no cell ${r},${c}`);
  }
  return found;
}

function noneButton(el: HTMLElement): HTMLButtonElement {
  const found = el.querySelector<HTMLButtonElement>('[data-testid="payoff-none"]');
  if (!found) {
    throw new Error('no none button');
  }
  return found;
}

function rowHeader(el: HTMLElement, index: number): HTMLElement {
  return el.querySelectorAll<HTMLElement>('th[scope="row"]')[index];
}

function colHeader(el: HTMLElement, index: number): HTMLElement {
  return el.querySelectorAll<HTMLElement>('th[scope="col"]')[index];
}

describe('PayoffMatrixWidget (G14, §12)', () => {
  it('renders one table with one visually hidden caption, one row header per row and one column header per column', () => {
    const el = root(render());
    expect(el.querySelectorAll('table')).toHaveLength(1);
    const captions = el.querySelectorAll('caption');
    expect(captions).toHaveLength(1);
    expect(captions[0].classList).toContain('sr-only');
    expect(el.querySelectorAll('th[scope="row"]')).toHaveLength(3);
    expect(el.querySelectorAll('th[scope="col"]')).toHaveLength(3);
  });

  it('makes each cell a native button with type, aria-pressed, a test id and the row and column aria-label', () => {
    const el = root(render());
    expect(el.querySelectorAll('tbody button')).toHaveLength(9);
    for (const button of el.querySelectorAll('tbody button')) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.getAttribute('data-testid')).toMatch(/^payoff-cell-\d-\d$/);
      expect(button.getAttribute('tabindex')).toBeNull();
    }
    expect(cell(el, 2, 2).getAttribute('aria-label')).toMatch(
      /^Row Advertise, column Advertise: row 3, column 3\b/,
    );
    expect(cell(el, 0, 1).getAttribute('aria-label')).toMatch(
      /^Row Price cut, column Hold: row 1, column 2\b/,
    );
  });

  it('gives each cell the standard focus ring and a 48px minimum height', () => {
    const classes = [...cell(root(render()), 0, 0).classList];
    expect(classes).toEqual(
      expect.arrayContaining([
        'min-h-12',
        'focus-visible:ring-2',
        'ring-focus',
        'ring-offset-2',
        'ring-offset-surface',
      ]),
    );
  });

  it('toggles a cell on the click that Space and Enter produce, and ignores the keydown itself', () => {
    const fixture = render();
    const el = root(fixture);
    const target = cell(el, 0, 0);

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();
    expect(target.getAttribute('aria-pressed')).toBe('false');

    target.click();
    fixture.detectChanges();
    expect(target.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.selected()).toEqual([{ r: 0, c: 0 }]);

    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    target.click();
    fixture.detectChanges();
    expect(target.getAttribute('aria-pressed')).toBe('false');
    expect(fixture.componentInstance.selected()).toEqual([]);
  });

  it('shows a selected cell with the accent look and the visible word Selected', () => {
    const fixture = render();
    const target = cell(root(fixture), 1, 2);
    target.click();
    fixture.detectChanges();
    expect([...target.classList]).toEqual(
      expect.arrayContaining(['border-accent', 'bg-accent-subtle']),
    );
    expect(target.textContent).toContain('Selected');
  });

  it('underlines a best-response payoff with no colour class, and leaves other payoffs plain', () => {
    const el = root(render());
    const underlined = [...cell(el, 0, 0).querySelectorAll('.underline')];
    expect(underlined).toHaveLength(2);
    for (const span of underlined) {
      expect([...span.classList].filter((name) => COLOUR_UTILITY.test(name))).toEqual([]);
    }
    expect(cell(el, 0, 1).querySelectorAll('.underline')).toHaveLength(0);
  });

  it('marks an eliminated row or column with line-through and the visible text "Eliminated (step N)"', () => {
    const el = root(
      render({
        eliminated: [
          { player: 'col', index: 0, step: 1 },
          { player: 'row', index: 1, step: 2 },
        ],
      }),
    );
    expect(colHeader(el, 0).querySelector('.line-through')).not.toBeNull();
    expect(colHeader(el, 0).textContent).toContain('Eliminated (step 1)');
    expect(rowHeader(el, 1).querySelector('.line-through')).not.toBeNull();
    expect(rowHeader(el, 1).textContent).toContain('Eliminated (step 2)');
    expect(rowHeader(el, 0).querySelector('.line-through')).toBeNull();
    expect(rowHeader(el, 0).textContent).not.toContain('Eliminated');
  });

  it('maps correct, wrong and missed cells to the OUTCOME_LOOK glyph, word and tone', () => {
    const el = root(
      render({
        cellGrades: [
          { r: 0, c: 0, outcome: 'correct' },
          { r: 0, c: 1, outcome: 'wrong' },
          { r: 1, c: 1, outcome: 'missed' },
        ],
      }),
    );
    const correct = cell(el, 0, 0).querySelector('ui-status > span');
    expect(correct?.classList).toContain('text-success');
    expect(correct?.textContent).toContain('✓');
    expect(correct?.textContent).toContain('Correct');

    const wrong = cell(el, 0, 1).querySelector('ui-status > span');
    expect(wrong?.classList).toContain('text-danger');
    expect(wrong?.textContent).toContain('✗');
    expect(wrong?.textContent).toContain('Wrong');

    const missed = cell(el, 1, 1).querySelector('ui-status > span');
    expect(missed?.classList).toContain('text-warning');
    expect(missed?.textContent).toContain('!');
    expect(missed?.textContent).toContain('Missed');
  });

  it('puts the outcome word into the cell aria-label so screen readers hear the grade', () => {
    const el = root(render({ cellGrades: [{ r: 0, c: 0, outcome: 'correct' }] }));
    expect(cell(el, 0, 0).getAttribute('aria-label')).toContain('Correct');
  });

  it('renders the None button as a native button, always, even when the matrix has a pure equilibrium', () => {
    const el = root(render());
    const none = noneButton(el);
    expect(none.tagName).toBe('BUTTON');
    expect(none.getAttribute('type')).toBe('button');
    expect(none.getAttribute('aria-pressed')).toBe('false');
    expect(none.textContent).toContain('None of these (no pure equilibrium)');
  });

  it('shows a graded None answer with its glyph and word', () => {
    const el = root(render({ noneGrade: 'correct' }));
    const status = noneButton(el).querySelector('ui-status > span');
    expect(status?.classList).toContain('text-success');
    expect(status?.textContent).toContain('✓');
    expect(status?.textContent).toContain('Correct');
  });

  it('pressing None clears the cell selection, and pressing a cell turns None off', () => {
    const fixture = render();
    const el = root(fixture);
    cell(el, 0, 0).click();
    fixture.detectChanges();

    noneButton(el).click();
    fixture.detectChanges();
    expect(noneButton(el).getAttribute('aria-pressed')).toBe('true');
    expect(cell(el, 0, 0).getAttribute('aria-pressed')).toBe('false');
    expect(fixture.componentInstance.selected()).toEqual([]);
    expect(fixture.componentInstance.noneChosen()).toBe(true);

    cell(el, 0, 1).click();
    fixture.detectChanges();
    expect(noneButton(el).getAttribute('aria-pressed')).toBe('false');
    expect(fixture.componentInstance.noneChosen()).toBe(false);
    expect(fixture.componentInstance.selected()).toEqual([{ r: 0, c: 1 }]);
  });
});
