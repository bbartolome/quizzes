import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CalibrationSparkline } from './calibration-sparkline';
import { BucketStat } from './calibration.models';

describe('CalibrationSparkline', () => {
  let fixture: ComponentFixture<CalibrationSparkline>;

  const bucket = (stop: number, n: number, hits: number): BucketStat => ({
    stop,
    n,
    hits,
    pct: n === 0 ? null : (hits / n) * 100,
    lo: n === 0 ? null : Math.max(0, (hits / n) * 100 - 10),
    hi: n === 0 ? null : Math.min(100, (hits / n) * 100 + 10),
  });

  const buckets: BucketStat[] = [
    bucket(50, 4, 2),
    bucket(60, 0, 0),
    bucket(70, 10, 7),
    bucket(80, 10, 8),
    bucket(90, 0, 0),
    bucket(100, 5, 5),
  ];

  const q = (selector: string): Element | null => fixture.nativeElement.querySelector(selector);
  const qa = (selector: string): Element[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalibrationSparkline] });
    fixture = TestBed.createComponent(CalibrationSparkline);
    fixture.componentRef.setInput('format', 'two-way');
    fixture.componentRef.setInput('buckets', buckets);
    fixture.detectChanges();
  });

  it('labels the svg as the lifetime calibration curve', () => {
    const svg = q('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Lifetime calibration curve');
  });

  it('draws one point per non-empty bucket', () => {
    expect(qa('[data-point]').length).toBe(4);
  });

  it('strokes the curve segments and the diagonal with tokens', () => {
    const segments = qa('line').filter((l) => !l.hasAttribute('data-diagonal'));
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(segment.getAttribute('class')).toContain('stroke-text');
    }
    expect(q('[data-diagonal]')?.getAttribute('class')).toContain('stroke-strong');
  });

  it('fills the points with the text token', () => {
    for (const point of qa('[data-point]')) {
      expect(point.getAttribute('class')).toContain('fill-text');
    }
  });

  it('draws the diagonal', () => {
    expect(q('[data-diagonal]')).not.toBeNull();
  });

  it('draws no points when every bucket is empty', () => {
    fixture.componentRef.setInput('buckets', [bucket(50, 0, 0), bucket(60, 0, 0)]);
    fixture.detectChanges();
    expect(qa('[data-point]').length).toBe(0);
    expect(q('[data-diagonal]')).not.toBeNull();
  });

  it('follows the format when it changes', () => {
    fixture.componentRef.setInput('format', 'four-way');
    fixture.componentRef.setInput('buckets', [bucket(0, 3, 1), bucket(25, 0, 0), bucket(50, 6, 3)]);
    fixture.detectChanges();
    expect(qa('[data-point]').length).toBe(2);
  });

  it('shows no bars, table, toggle button or n labels', () => {
    expect(q('table')).toBeNull();
    expect(q('button')).toBeNull();
    expect(q('[data-bar]')).toBeNull();
    expect(q('text')).toBeNull();
  });
});
