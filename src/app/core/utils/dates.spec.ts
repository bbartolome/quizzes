import { describe, it, expect, vi } from 'vitest';
import { addDays, dateKeyOf, dayNumber } from './dates';

describe('dateKeyOf', () => {
  it('formats the local calendar date as YYYY-MM-DD with zero padding', () => {
    expect(dateKeyOf(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    expect(dateKeyOf(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
  });

  it('uses the local date near midnight, not the UTC date', () => {
    expect(dateKeyOf(new Date(2026, 2, 15, 0, 30))).toBe('2026-03-15');
    expect(dateKeyOf(new Date(2026, 0, 31, 23, 59, 59))).toBe('2026-01-31');
  });

  it('never calls toISOString', () => {
    const spy = vi.spyOn(Date.prototype, 'toISOString');
    try {
      dateKeyOf(new Date(2026, 5, 1, 0, 0));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('gives consecutive keys either side of a DST start', () => {
    expect(dateKeyOf(new Date(2026, 2, 7, 23, 0))).toBe('2026-03-07');
    expect(dateKeyOf(new Date(2026, 2, 8, 23, 0))).toBe('2026-03-08');
  });
});

describe('dayNumber', () => {
  it('is zero on the Unix epoch day', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
  });

  it('differs by exactly 1 for consecutive days', () => {
    expect(dayNumber('2026-03-09') - dayNumber('2026-03-08')).toBe(1);
    expect(dayNumber('2026-11-02') - dayNumber('2026-11-01')).toBe(1);
  });

  it('counts a leap day', () => {
    expect(dayNumber('2024-02-29') - dayNumber('2024-02-28')).toBe(1);
    expect(dayNumber('2024-03-01') - dayNumber('2024-02-28')).toBe(2);
  });

  it('counts across year boundaries', () => {
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
  });
});

describe('addDays', () => {
  it('returns the same key for n = 0', () => {
    expect(addDays('2026-07-04', 0)).toBe('2026-07-04');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('goes backwards with a negative n', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('is the inverse of dayNumber arithmetic', () => {
    for (const n of [-400, -7, -1, 1, 7, 10, 366]) {
      const key = '2026-03-08';
      expect(dayNumber(addDays(key, n)) - dayNumber(key)).toBe(n);
    }
  });

  it('adds whole days across the DST start', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-07', 7)).toBe('2026-03-14');
  });
});
