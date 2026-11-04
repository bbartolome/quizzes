import { describe, expect, it } from 'vitest';
import { dailyDifficulty, dailyKind, dailyPlanOf, dailyRng, dailySeedKey } from './daily';
import { hashSeed, mulberry32 } from './rng';

// The daily puzzle (spec §9.2). Seeded by the date, so every visit that day draws the same item.

describe('daily seed and rng (spec §9.2)', () => {
  it('seeds from the date, so the same day gives the same stream and a new day a new one', () => {
    expect(dailySeedKey('2026-11-04')).toBe('gt-daily/v1/2026-11-04');
    const a = dailyRng('2026-11-04');
    const b = dailyRng('2026-11-04');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(dailyRng('2026-11-05')()).not.toBe(dailyRng('2026-11-04')());
    expect(dailyRng('2026-11-04')()).toBe(mulberry32(hashSeed('gt-daily/v1/2026-11-04'))());
  });
});

describe('dailyKind (spec §9.2: rotation over the kinds the player can draw)', () => {
  it('rotates through the drawable kinds by day number, one per day', () => {
    const kinds = ['equilibrium', 'classify', 'eliminate'] as const;
    const days = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const picked = days.map((d) => dailyKind(d, [...kinds]));

    expect(new Set(picked.slice(0, 3)).size).toBe(3);
    expect(picked[3]).toBe(picked[0]);
  });

  it('returns null when no kind can be drawn yet', () => {
    expect(dailyKind('2026-11-04', [])).toBeNull();
  });
});

describe('dailyDifficulty (spec §9.2: capped at 2, gated like the puzzle set)', () => {
  const none = () => false;
  const all = () => true;

  it('stays at 1 for an equilibrium item until nash-equilibrium is Practised, then goes to 2', () => {
    expect(dailyDifficulty('equilibrium', none)).toBe(1);
    expect(dailyDifficulty('equilibrium', (id) => id === 'nash-equilibrium')).toBe(2);
  });

  it('needs dominant-strategy Practised for an elimination item at 2', () => {
    expect(dailyDifficulty('eliminate', (id) => id === 'nash-equilibrium')).toBe(1);
    expect(dailyDifficulty('eliminate', (id) => id === 'dominant-strategy')).toBe(2);
  });

  it('is 2 for classify, which has no gate, and never 3', () => {
    expect(dailyDifficulty('classify', none)).toBe(2);
    expect(dailyDifficulty('equilibrium', all)).toBe(2);
  });
});

describe('dailyPlanOf (the plan that is locked in on the first open of the day)', () => {
  it('holds the date, the kind, the difficulty and the seed key', () => {
    const plan = dailyPlanOf('2026-11-04', ['classify'], () => false);

    expect(plan).toEqual({
      version: 1,
      dateKey: '2026-11-04',
      kind: 'classify',
      difficulty: 2,
      seedKey: 'gt-daily/v1/2026-11-04',
    });
  });

  it('is null when nothing can be drawn', () => {
    expect(dailyPlanOf('2026-11-04', [], () => false)).toBeNull();
  });
});
