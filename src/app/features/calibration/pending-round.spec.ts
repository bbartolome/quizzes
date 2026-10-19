import { describe, expect, it } from 'vitest';
import { CalibrationBank, CalibrationItem, PendingRound, TOPICS } from './calibration.models';
import { allItemsAnswered, isItemAnswered, resumeOrDraw, setPick } from './pending-round';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBank(size: number, version = 3): CalibrationBank {
  const items: CalibrationItem[] = Array.from({ length: size }, (_, i) => ({
    id: `i${i}`,
    prompt: `Prompt ${i}`,
    options: ['A', 'B'],
    correct: 0,
    topic: TOPICS[i % TOPICS.length],
    fact: 'Fact',
    source: { label: 'Src', url: 'https://example.com' },
  }));
  return { version, items };
}

function pendingOf(ids: string[], bankVersion = 3): PendingRound {
  return {
    bankVersion,
    items: ids.map((itemId) => ({ itemId, swapped: false })),
    picks: {},
  };
}

describe('setPick', () => {
  it('returns a new object and leaves the original untouched', () => {
    const before = pendingOf(['a', 'b']);
    const after = setPick(before, 'a', { pick: 0, confidence: 70 });
    expect(after).not.toBe(before);
    expect(before.picks).toEqual({});
    expect(after.picks['a']).toEqual({ pick: 0, confidence: 70 });
  });

  it('replaces an earlier pick for the same item', () => {
    const first = setPick(pendingOf(['a']), 'a', { pick: 0, confidence: 70 });
    const second = setPick(first, 'a', { pick: 1, confidence: 90 });
    expect(second.picks['a']).toEqual({ pick: 1, confidence: 90 });
  });

  it('leaves other items alone', () => {
    const first = setPick(pendingOf(['a', 'b']), 'a', { pick: 0, confidence: 60 });
    const second = setPick(first, 'b', { pick: 1, confidence: 80 });
    expect(second.picks['a']).toEqual({ pick: 0, confidence: 60 });
    expect(second.bankVersion).toBe(3);
    expect(second.items).toEqual(first.items);
  });
});

describe('isItemAnswered', () => {
  it('needs both pick and confidence', () => {
    const p = pendingOf(['a', 'b', 'c', 'd']);
    p.picks = {
      a: { pick: 0 },
      b: { confidence: 70 },
      c: { pick: 0, confidence: 70 },
    };
    expect(isItemAnswered(p, 'a')).toBe(false);
    expect(isItemAnswered(p, 'b')).toBe(false);
    expect(isItemAnswered(p, 'c')).toBe(true);
    expect(isItemAnswered(p, 'd')).toBe(false);
  });

  it('treats pick 0 as answered', () => {
    const p = setPick(pendingOf(['a']), 'a', { pick: 0, confidence: 50 });
    expect(isItemAnswered(p, 'a')).toBe(true);
  });
});

describe('allItemsAnswered', () => {
  it('is false for a partial round', () => {
    const p = setPick(pendingOf(['a', 'b']), 'a', { pick: 0, confidence: 70 });
    expect(allItemsAnswered(p)).toBe(false);
  });

  it('is false when there are no items', () => {
    expect(allItemsAnswered(pendingOf([]))).toBe(false);
  });

  it('is true when every item has pick and confidence', () => {
    let p = pendingOf(['a', 'b']);
    p = setPick(p, 'a', { pick: 0, confidence: 70 });
    p = setPick(p, 'b', { pick: [true, false], confidence: 75 });
    expect(allItemsAnswered(p)).toBe(true);
  });
});

describe('resumeOrDraw', () => {
  it('keeps an existing pending round with a matching bankVersion', () => {
    const bank = makeBank(30);
    const existing = setPick(pendingOf(['i1', 'i2']), 'i1', { pick: 0, confidence: 80 });
    const result = resumeOrDraw(existing, bank, [], mulberry32(1));
    expect(result.fresh).toBe(false);
    expect(result.pending).toBe(existing);
  });

  it('draws a new round when there is none', () => {
    const bank = makeBank(30);
    const result = resumeOrDraw(null, bank, [], mulberry32(1));
    expect(result.fresh).toBe(true);
    expect(result.pending.picks).toEqual({});
    expect(result.pending.bankVersion).toBe(3);
    expect(result.pending.items).toHaveLength(20);
  });

  it('draws a new round when the bankVersion differs', () => {
    const bank = makeBank(30, 4);
    const stale = setPick(pendingOf(['i1'], 3), 'i1', { pick: 0, confidence: 80 });
    const result = resumeOrDraw(stale, bank, [], mulberry32(2));
    expect(result.fresh).toBe(true);
    expect(result.pending.bankVersion).toBe(4);
    expect(result.pending.picks).toEqual({});
  });

  it('draws min(20, bank size) items from a small bank', () => {
    const bank = makeBank(7);
    const result = resumeOrDraw(null, bank, [], mulberry32(3));
    expect(result.pending.items).toHaveLength(7);
    const ids = new Set(result.pending.items.map((d) => d.itemId));
    expect(ids.size).toBe(7);
  });
});
