/** Local calendar date, 'YYYY-MM-DD'. */
export type DateKey = string;

const DAY_MS = 86_400_000;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function parts(key: DateKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** The local calendar date of `d`. Uses local getters, never toISOString. */
export function dateKeyOf(d: Date): DateKey {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days since 1970-01-01, computed in UTC so DST never shifts it. */
export function dayNumber(key: DateKey): number {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** The date `n` calendar days after `key` (negative `n` goes back). */
export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = parts(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
