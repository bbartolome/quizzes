import { describe, expect, it } from 'vitest';
import type { QuizManifestEntry } from '../../core/models/quiz.models';
import type { CalibrationBank, CalibrationFormat, CalibrationItem } from './calibration.models';
import { TOPICS, isFourWayItem } from './calibration.models';
import manifestJson from '../../../../public/data/quizzes.json';
import twoWayJson from '../../../../public/data/quizzes/calibration/items.json';
import fourWayJson from '../../../../public/data/quizzes/calibration-advanced/items.json';

// Build-time guard over the real data files shipped under public/.
const manifest = manifestJson as unknown as { quizzes: QuizManifestEntry[] };
const banksByDataPath: Record<string, CalibrationBank> = {
  'data/quizzes/calibration/': twoWayJson as unknown as CalibrationBank,
  'data/quizzes/calibration-advanced/': fourWayJson as unknown as CalibrationBank,
};

const entries = manifest.quizzes.filter((q) => q.kind === 'calibration');

function bankFor(entry: QuizManifestEntry): CalibrationBank {
  const key = entry.dataPath.endsWith('/') ? entry.dataPath : `${entry.dataPath}/`;
  const bank = banksByDataPath[key];
  if (!bank)
    throw new Error(`No bank imported for ${entry.id} (${key}); add it to banksByDataPath`);
  return bank;
}

function outcomeOf(truth: [boolean, boolean]): string {
  if (truth[0] && truth[1]) return 'both';
  if (truth[0]) return 'a';
  if (truth[1]) return 'b';
  return 'neither';
}

describe('calibration banks', () => {
  it('has at least one calibration entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const entry of entries) {
    describe(entry.id, () => {
      const bank = bankFor(entry);

      it('declares a format', () => {
        expect(['two-way', 'four-way']).toContain(entry.format);
      });

      it('bank.version matches the manifest version', () => {
        expect(bank.version).toBe(entry.version);
      });

      it('has unique item ids', () => {
        const ids = bank.items.map((i) => i.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('has well-formed items for its format', () => {
        const format = entry.format as CalibrationFormat;
        for (const item of bank.items as CalibrationItem[]) {
          expect(TOPICS, `${item.id} topic`).toContain(item.topic);
          expect(item.options, `${item.id} options`).toHaveLength(2);
          expect(item.source.label, `${item.id} source label`).toBeTruthy();
          expect(item.source.url, `${item.id} source url`).toBeTruthy();
          if (format === 'two-way') {
            expect(isFourWayItem(item), `${item.id} is two-way`).toBe(false);
            expect([0, 1], `${item.id} correct`).toContain((item as { correct: number }).correct);
            expect((item as { fact: string }).fact, `${item.id} fact`).toBeTruthy();
          } else {
            expect(isFourWayItem(item), `${item.id} is four-way`).toBe(true);
            if (isFourWayItem(item)) {
              expect(item.truth, `${item.id} truth`).toHaveLength(2);
              expect(item.facts, `${item.id} facts`).toHaveLength(2);
            }
          }
        }
      });

      if (entry.format === 'four-way') {
        it('covers every outcome (Neither, A, B, Both) at least once', () => {
          const seen = new Set(bank.items.filter(isFourWayItem).map((i) => outcomeOf(i.truth)));
          expect([...seen].sort()).toEqual(['a', 'b', 'both', 'neither']);
        });
      }
    });
  }

  it('shares no item id between banks', () => {
    const seen = new Set<string>();
    for (const entry of entries) {
      for (const item of bankFor(entry).items) {
        expect(seen.has(item.id), `${item.id} appears in more than one bank`).toBe(false);
        seen.add(item.id);
      }
    }
  });
});
