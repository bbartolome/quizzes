import type { Fraction, MixedNash2x2, PayoffMatrix } from './matrix.types';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The fraction num/den, reduced, with den > 0. The caller guarantees den is not zero. */
function fraction(num: number, den: number): Fraction {
  const sign = den < 0 ? -1 : 1;
  const n = sign * num;
  const d = sign * den;
  const g = gcd(Math.abs(n), d);
  return { num: n === 0 ? 0 : n / g, den: d / g };
}

/** True when the fraction lies strictly between 0 and 1. Its den is positive, so this is exact. */
const isOpenUnit = (f: Fraction): boolean => f.num > 0 && f.num < f.den;

/**
 * The mixed equilibrium of a 2x2 game, in exact fractions. Each player's mix makes the other player
 * indifferent. `null` unless both denominators are non-zero and both mixes lie strictly in (0, 1).
 */
export function mixedNash2x2(m: PayoffMatrix): MixedNash2x2 | null {
  if (m.rows !== 2 || m.cols !== 2) {
    return null;
  }
  const [[r00, r01], [r10, r11]] = m.row;
  const [[c00, c01], [c10, c11]] = m.col;
  const qDen = r00 - r01 - r10 + r11;
  const pDen = c00 - c10 - c01 + c11;
  if (qDen === 0 || pDen === 0) {
    return null;
  }
  // q: the column mix that makes the row player indifferent. p: the row mix that makes the column player indifferent.
  const q = fraction(r11 - r01, qDen);
  const p = fraction(c11 - c10, pDen);
  if (!isOpenUnit(p) || !isOpenUnit(q)) {
    return null;
  }
  return {
    p,
    q,
    // rowValue = q * r00 + (1 - q) * r01, and colValue = p * c00 + (1 - p) * c10.
    rowValue: fraction(q.num * (r00 - r01) + r01 * q.den, q.den),
    colValue: fraction(p.num * (c00 - c10) + c10 * p.den, p.den),
  };
}
