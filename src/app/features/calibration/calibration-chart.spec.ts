import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CalibrationChart } from './calibration-chart';
import { BucketStat } from './calibration.models';
import { FORMATS } from './calibration-format';

// The data-* attributes (data-point, data-overlay-point, data-overlay-line, data-n)
// are the stable hooks for this spec; markup and classes may change freely.

function buckets(counts: Record<number, [number, number]>): BucketStat[] {
  return FORMATS['two-way'].stops.map((stop) => {
    const [n, hits] = counts[stop] ?? [0, 0];
    return n === 0
      ? { stop, n, hits, pct: null, lo: null, hi: null }
      : {
          stop,
          n,
          hits,
          pct: (hits / n) * 100,
          lo: Math.max(0, (hits / n) * 100 - 20),
          hi: Math.min(100, (hits / n) * 100 + 20),
        };
  });
}

const MAIN = buckets({ 50: [4, 2], 70: [5, 3], 90: [6, 5] });
const OVERLAY = buckets({ 50: [2, 1], 70: [3, 2], 100: [2, 2] });

describe('CalibrationChart', () => {
  let fixture: ComponentFixture<CalibrationChart>;

  const el = (): HTMLElement => fixture.nativeElement;
  const render = (inputs: Record<string, unknown>): void => {
    fixture.componentRef.setInput('format', 'two-way');
    fixture.componentRef.setInput('buckets', MAIN);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalibrationChart] });
    fixture = TestBed.createComponent(CalibrationChart);
  });

  it('renders an svg image with a non-empty aria-label', () => {
    render({});
    const svg = el().querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')?.trim()).toBeTruthy();
  });

  it('draws one point per non-empty bucket', () => {
    render({});
    expect(el().querySelectorAll('[data-point]').length).toBe(3);
  });

  it('labels every x tick with its n', () => {
    render({});
    const labels = Array.from(el().querySelectorAll('[data-n]')).map((n) => n.textContent?.trim());
    expect(labels).toEqual(['4', '0', '5', '0', '6', '0']);
  });

  it('renders overlay markers and a dashed overlay line', () => {
    render({ overlay: OVERLAY });
    expect(el().querySelectorAll('[data-overlay-point]').length).toBe(3);
    const line = el().querySelector('[data-overlay-line]');
    expect(line).not.toBeNull();
    expect(line?.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('omits overlay markers when there is no overlay', () => {
    render({});
    expect(el().querySelector('[data-overlay-point]')).toBeNull();
    expect(el().querySelector('[data-overlay-line]')).toBeNull();
  });

  it('shows the too-few-answers note only on the first round', () => {
    render({ firstRound: true });
    expect(el().textContent).toContain('too few answers');

    fixture.componentRef.setInput('firstRound', false);
    fixture.detectChanges();
    expect(el().textContent).not.toContain('too few answers');
  });

  it('toggles the data table with the Show as table button', () => {
    render({});
    expect(el().querySelector('app-chart-table')).toBeNull();

    const button = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show as table'),
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();

    button.click();
    fixture.detectChanges();
    expect(el().querySelector('app-chart-table')).not.toBeNull();
    expect(el().querySelector('table')).not.toBeNull();

    button.click();
    fixture.detectChanges();
    expect(el().querySelector('app-chart-table')).toBeNull();
  });
});
