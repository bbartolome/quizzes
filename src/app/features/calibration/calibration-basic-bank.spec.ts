import { describe, expect, it } from 'vitest';
import type { QuizManifestEntry } from '../../core/models/quiz.models';
import { TOPICS, type CalibrationBank, type TwoWayItem } from './calibration.models';
import manifestJson from '../../../../public/data/quizzes.json';
import basicJson from '../../../../public/data/quizzes/calibration-basic/items.json';
import twoWayJson from '../../../../public/data/quizzes/calibration/items.json';
import fourWayJson from '../../../../public/data/quizzes/calibration-advanced/items.json';

// Shape guard for the Confidence: Basic bank (spec §3.5). Truth of each fact is checked
// by search during authoring, not here: a test can only check shape.
const bank = basicJson as unknown as CalibrationBank;
const items = bank.items as TwoWayItem[];
const manifest = manifestJson as unknown as { quizzes: QuizManifestEntry[] };
const basicEntry = manifest.quizzes.find((q) => q.id === 'calibration-basic');

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe('calibration-basic bank', () => {
  it('has a manifest entry whose version matches the bank', () => {
    expect(basicEntry).toBeDefined();
    expect(bank.version).toBe(basicEntry!.version);
    expect(basicEntry!.roundSize).toBe(10);
    expect(basicEntry!.format).toBe('two-way');
  });

  it('has unique ids that are disjoint from every other bank', () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const others = new Set([
      ...(twoWayJson as unknown as CalibrationBank).items.map((i) => i.id),
      ...(fourWayJson as unknown as CalibrationBank).items.map((i) => i.id),
    ]);
    for (const id of ids) {
      expect(others.has(id), `${id} clashes with another bank`).toBe(false);
    }
  });

  it('gives every item a known topic, a level of 1, 2 or 3, and a fact and source', () => {
    for (const item of items) {
      expect(TOPICS, `${item.id} topic`).toContain(item.topic);
      expect([1, 2, 3], `${item.id} level`).toContain(item.level);
      expect(item.fact, `${item.id} fact`).toBeTruthy();
      expect(item.source.url, `${item.id} source url`).toMatch(/^https:\/\//);
      expect(item.source.label, `${item.id} source label`).toBeTruthy();
    }
  });

  it('has two options of 1 to 4 words each and a valid correct index', () => {
    for (const item of items) {
      expect(item.options, `${item.id} options`).toHaveLength(2);
      for (const option of item.options) {
        expect(wordCount(option), `${item.id} option "${option}"`).toBeGreaterThanOrEqual(1);
        expect(wordCount(option), `${item.id} option "${option}"`).toBeLessThanOrEqual(4);
      }
      expect([0, 1], `${item.id} correct`).toContain(item.correct);
    }
  });

  it('has at least 10 level-1, 10 level-2 and 4 level-3 items in each topic', () => {
    for (const topic of TOPICS) {
      const inTopic = items.filter((i) => i.topic === topic);
      expect(
        inTopic.filter((i) => i.level === 1).length,
        `${topic} level 1`,
      ).toBeGreaterThanOrEqual(10);
      expect(
        inTopic.filter((i) => i.level === 2).length,
        `${topic} level 2`,
      ).toBeGreaterThanOrEqual(10);
      expect(
        inTopic.filter((i) => i.level === 3).length,
        `${topic} level 3`,
      ).toBeGreaterThanOrEqual(4);
    }
  });
});
