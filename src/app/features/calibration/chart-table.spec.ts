import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChartTable } from './chart-table';
import type { BucketStat } from './calibration.models';

const buckets: BucketStat[] = [
  { stop: 50, n: 0, hits: 0, pct: null, lo: null, hi: null },
  { stop: 70, n: 10, hits: 7, pct: 70, lo: 39.7, hi: 89.2 },
  { stop: 90, n: 3, hits: 2, pct: 66.67, lo: 20.8, hi: 93.9 },
];

const overlay: BucketStat[] = [
  { stop: 50, n: 0, hits: 0, pct: null, lo: null, hi: null },
  { stop: 70, n: 4, hits: 3, pct: 75, lo: 30, hi: 95 },
  { stop: 90, n: 0, hits: 0, pct: null, lo: null, hi: null },
];

function render(b: BucketStat[], o?: BucketStat[] | null) {
  const fixture = TestBed.createComponent(ChartTable);
  fixture.componentRef.setInput('buckets', b);
  if (o !== undefined) fixture.componentRef.setInput('overlay', o);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  const cells = rows.map((r) =>
    Array.from(r.querySelectorAll('td, th')).map((c) => (c.textContent ?? '').trim()),
  );
  return { root, rows, cells };
}

describe('ChartTable', () => {
  it('styles the header row as caption text and right-aligns the numbers', () => {
    const { root } = render(buckets);
    expect(root.querySelector('thead th')?.className).toContain('type-caption');
    expect(root.querySelectorAll('tbody td')[1]?.className).toContain('tabular-nums');
  });

  it('renders a table', () => {
    const { root } = render(buckets);
    expect(root.querySelector('table')).not.toBeNull();
  });

  it('renders one row per bucket', () => {
    const { rows } = render(buckets);
    expect(rows.length).toBe(3);
  });

  it('shows the stop as a percentage', () => {
    const { cells } = render(buckets);
    expect(cells.map((c) => c[0])).toEqual(['50%', '70%', '90%']);
  });

  it('shows n', () => {
    const { cells } = render(buckets);
    expect(cells.map((c) => c[1])).toEqual(['0', '10', '3']);
  });

  it('shows the rounded % correct', () => {
    const { cells } = render(buckets);
    expect(cells[1][2]).toBe('70%');
    expect(cells[2][2]).toBe('67%');
  });

  it('shows the rounded Wilson range', () => {
    const { cells } = render(buckets);
    expect(cells[1][3]).toBe('40–89%');
    expect(cells[2][3]).toBe('21–94%');
  });

  it('shows an em dash for % correct and range of an empty bucket', () => {
    const { cells } = render(buckets);
    expect(cells[0][2]).toBe('—');
    expect(cells[0][3]).toBe('—');
  });

  it('shows overlay hits/n for the matching stop', () => {
    const { cells } = render(buckets, overlay);
    expect(cells[1][4]).toBe('3/4');
  });

  it('shows an em dash in the overlay column for an empty overlay bucket', () => {
    const { cells } = render(buckets, overlay);
    expect(cells[0][4]).toBe('—');
    expect(cells[2][4]).toBe('—');
  });

  it('shows an em dash in the overlay column without an overlay', () => {
    const { cells } = render(buckets);
    expect(cells.map((c) => c[4])).toEqual(['—', '—', '—']);
  });
});
