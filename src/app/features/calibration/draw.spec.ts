import { describe, it, expect } from 'vitest';
import { ROUND_SIZE, drawRound, seenItemIds, shuffle, unseenCount, Rng } from './draw';
import { CalibrationBank, CalibrationRound, TOPICS, Topic, TwoWayItem } from './calibration.models';

function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBank(perTopic: number, topics: readonly Topic[] = TOPICS): CalibrationBank {
  const items: TwoWayItem[] = [];
  for (const topic of topics) {
    for (let i = 0; i < perTopic; i++) {
      items.push({
        id: `${topic}-${i}`,
        prompt: `Prompt ${topic} ${i}`,
        options: ['A', 'B'],
        correct: 0,
        topic,
        fact: 'A fact.',
        source: { label: 'Source', url: 'https://example.com' },
      });
    }
  }
  return { version: 1, items };
}

function topicOf(bank: CalibrationBank, id: string): Topic {
  return bank.items.find((item) => item.id === id)!.topic;
}

function roundOf(submittedAt: string, itemIds: string[]): CalibrationRound {
  return {
    submittedAt,
    bankVersion: 1,
    answers: itemIds.map((itemId) => ({ itemId, pick: 0, confidence: 70, correct: true })),
  };
}

function ids(bank: CalibrationBank, from: number, to: number): string[] {
  return bank.items.slice(from, to).map((item) => item.id);
}

describe('ROUND_SIZE', () => {
  it('is 20', () => {
    expect(ROUND_SIZE).toBe(20);
  });
});

describe('drawRound', () => {
  it('draws min(20, bank size) items', () => {
    expect(drawRound(makeBank(10), [], mulberry32(1))).toHaveLength(20);
    expect(drawRound(makeBank(4), [], mulberry32(1))).toHaveLength(20);
    expect(drawRound(makeBank(3), [], mulberry32(1))).toHaveLength(18);
  });

  it('draws a 12-item bank whole', () => {
    const bank = makeBank(2);
    const drawn = drawRound(bank, [], mulberry32(7));
    expect(drawn).toHaveLength(12);
    expect(drawn.map((d) => d.itemId).sort()).toEqual(bank.items.map((i) => i.id).sort());
  });

  it('gives each topic 3 or 4 slots, exactly two topics getting 4', () => {
    const bank = makeBank(10);
    for (let seed = 1; seed <= 25; seed++) {
      const drawn = drawRound(bank, [], mulberry32(seed));
      const counts = new Map<Topic, number>();
      for (const d of drawn) {
        const topic = topicOf(bank, d.itemId);
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }
      expect(counts.size).toBe(TOPICS.length);
      const values = [...counts.values()];
      expect(values.every((n) => n === 3 || n === 4)).toBe(true);
      expect(values.filter((n) => n === 4)).toHaveLength(2);
    }
  });

  it('picks the two 4-slot topics at random', () => {
    const bank = makeBank(10);
    const bigTopics = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const drawn = drawRound(bank, [], mulberry32(seed));
      const counts = new Map<Topic, number>();
      for (const d of drawn) {
        const topic = topicOf(bank, d.itemId);
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }
      for (const [topic, n] of counts) if (n === 4) bigTopics.add(topic);
    }
    expect(bigTopics.size).toBeGreaterThan(2);
  });

  it('lets freshness beat balance when a topic has too few unseen items', () => {
    const bank = makeBank(10);
    const history = bank.items.filter((i) => i.topic === 'history').map((i) => i.id);
    const log = [roundOf('2026-01-01T00:00:00.000Z', history.slice(0, 9))];
    for (let seed = 1; seed <= 15; seed++) {
      const drawn = drawRound(bank, log, mulberry32(seed));
      expect(drawn).toHaveLength(20);
      const seen = seenItemIds(log);
      expect(drawn.every((d) => !seen.has(d.itemId))).toBe(true);
      const fromHistory = drawn.filter((d) => topicOf(bank, d.itemId) === 'history');
      expect(fromHistory).toHaveLength(1);
    }
  });

  it('uses no repeats while at least 20 items are unseen', () => {
    const bank = makeBank(10);
    const log = [roundOf('2026-01-01T00:00:00.000Z', ids(bank, 0, 40))];
    expect(unseenCount(bank, log)).toBe(20);
    const seen = seenItemIds(log);
    const drawn = drawRound(bank, log, mulberry32(3));
    expect(drawn.every((d) => !seen.has(d.itemId))).toBe(true);
  });

  it('includes every unseen item and fills the rest with repeats when unseen < 20', () => {
    const bank = makeBank(25, ['history']);
    const oldIds = ids(bank, 0, 5);
    const newIds = ids(bank, 5, 13);
    const log = [
      roundOf('2026-02-01T00:00:00.000Z', newIds),
      roundOf('2026-01-01T00:00:00.000Z', oldIds),
    ];
    expect(unseenCount(bank, log)).toBe(12);
    const drawn = drawRound(bank, log, mulberry32(5)).map((d) => d.itemId);
    expect(drawn).toHaveLength(20);
    for (const id of ids(bank, 13, 25)) expect(drawn).toContain(id);
    // 8 repeats: the 5 oldest-answered first, then 3 from the newer round
    for (const id of oldIds) expect(drawn).toContain(id);
    expect(drawn.filter((id) => newIds.includes(id))).toHaveLength(3);
  });

  it('takes repeats least recently answered first by submittedAt, not log order', () => {
    const bank = makeBank(25, ['history']);
    const log = [
      roundOf('2026-03-01T00:00:00.000Z', ids(bank, 20, 25)),
      roundOf('2026-01-01T00:00:00.000Z', ids(bank, 0, 10)),
      roundOf('2026-02-01T00:00:00.000Z', ids(bank, 10, 20)),
    ];
    expect(unseenCount(bank, log)).toBe(0);
    // once everything is seen, oldest first: the two older rounds, not the newest
    const drawn = drawRound(bank, log, mulberry32(11)).map((d) => d.itemId);
    expect(drawn).toHaveLength(20);
    for (const id of ids(bank, 0, 20)) expect(drawn).toContain(id);
    for (const id of ids(bank, 20, 25)) expect(drawn).not.toContain(id);
  });

  it('never repeats an itemId within a round', () => {
    const bank = makeBank(10);
    const log = [roundOf('2026-01-01T00:00:00.000Z', ids(bank, 0, 50))];
    for (const l of [[], log]) {
      for (let seed = 1; seed <= 10; seed++) {
        const drawn = drawRound(bank, l, mulberry32(seed)).map((d) => d.itemId);
        expect(new Set(drawn).size).toBe(drawn.length);
      }
    }
  });

  it('flips sides independently: swapped is boolean and both values occur', () => {
    const bank = makeBank(10);
    const drawn = [1, 2, 3, 4, 5].flatMap((seed) => drawRound(bank, [], mulberry32(seed)));
    expect(drawn.every((d) => typeof d.swapped === 'boolean')).toBe(true);
    expect(drawn.some((d) => d.swapped)).toBe(true);
    expect(drawn.some((d) => !d.swapped)).toBe(true);
  });

  it('shuffles the output so topics are mixed', () => {
    const bank = makeBank(10);
    const drawn = drawRound(bank, [], mulberry32(42));
    const firstThree = drawn.slice(0, 3).map((d) => topicOf(bank, d.itemId));
    expect(new Set(firstThree).size).toBeGreaterThan(1);
    const topics = drawn.map((d) => topicOf(bank, d.itemId));
    const grouped = [...topics].sort();
    expect(topics).not.toEqual(grouped);
  });

  it('is deterministic for the same seed', () => {
    const bank = makeBank(10);
    const a = drawRound(bank, [], mulberry32(99));
    const b = drawRound(bank, [], mulberry32(99));
    expect(a).toEqual(b);
  });

  it('varies with the seed', () => {
    const bank = makeBank(10);
    const a = drawRound(bank, [], mulberry32(1));
    const b = drawRound(bank, [], mulberry32(2));
    expect(a).not.toEqual(b);
  });
});

describe('shuffle', () => {
  it('returns a permutation of the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(input, mulberry32(8));
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('returns a copy and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...input];
    const out = shuffle(input, mulberry32(8));
    expect(out).not.toBe(input);
    expect(input).toEqual(snapshot);
  });

  it('is deterministic for the same seed and handles empty input', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(input, mulberry32(4))).toEqual(shuffle(input, mulberry32(4)));
    expect(shuffle([], mulberry32(4))).toEqual([]);
  });
});

describe('seenItemIds / unseenCount', () => {
  it('collects every itemId in the log', () => {
    const log = [roundOf('2026-01-01T00:00:00.000Z', ['a', 'b']), roundOf('2026-01-02T00:00:00.000Z', ['b', 'c'])];
    expect(seenItemIds(log)).toEqual(new Set(['a', 'b', 'c']));
    expect(seenItemIds([])).toEqual(new Set());
  });

  it('counts bank items not in the log', () => {
    const bank = makeBank(2);
    expect(unseenCount(bank, [])).toBe(12);
    const log = [roundOf('2026-01-01T00:00:00.000Z', [...ids(bank, 0, 5), 'gone-item'])];
    expect(unseenCount(bank, log)).toBe(7);
  });
});
