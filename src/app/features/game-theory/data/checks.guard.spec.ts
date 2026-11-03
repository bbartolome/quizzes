import { describe, expect, it } from 'vitest';
import type { GameTheoryContent } from '../../../core/models/quiz.models';
import type { MisconceptionId, ReasonCheck } from '../lib/puzzle.types';
import checksJson from '../../../../../public/data/quizzes/game-theory/checks.json';
import conceptsJson from '../../../../../public/data/quizzes/game-theory/concepts.json';

// Build-time guards over the shipped reason checks (spec §5.3) and the misconception coverage
// rule (spec §6.5 and §11). Coverage reads both content files, so it lives in this spec.

interface ChecksFile {
  version: number;
  checks: ReasonCheck[];
}

const checks: ReasonCheck[] = (checksJson as unknown as ChecksFile).checks;
const concepts = (conceptsJson as unknown as GameTheoryContent).concepts;
const conceptIds = new Set(concepts.map((c) => c.id));

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONTEXTS: readonly ReasonCheck['context'][] = [
  'equilibrium',
  'classify',
  'eliminate',
  'bots',
  'beauty',
  'auction-first',
  'auction-second',
  'auction-common',
  'daily',
];
const OPTION_KEYS = ['id', 'text', 'correct', 'misconceptionId', 'why'];
// Every in-scope misconception from §11. M9 is not used.
const MISCONCEPTIONS: readonly MisconceptionId[] = [
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  'M7',
  'M8',
  'M10',
  'M11',
  'M12',
  'M13',
  'M14',
];

function sentenceCount(text: string): number {
  return text.trim().split(/(?<=[.!?])\s+/).length;
}

describe('game-theory reason checks (G15)', () => {
  it('has at least six reason checks', () => {
    expect(checks.length).toBeGreaterThanOrEqual(6);
  });

  it('guard: check ids are unique and kebab-case', () => {
    const ids = checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of checks) expect(c.id, `kebab-case id ${c.id}`).toMatch(KEBAB);
  });

  it('guard: each check has a known context and a prompt', () => {
    for (const c of checks) {
      expect(CONTEXTS, `${c.id} context`).toContain(c.context);
      expect(c.prompt.trim(), `${c.id} prompt`).not.toBe('');
    }
  });

  it('guard: conceptId exists', () => {
    for (const c of checks) {
      expect(conceptIds.has(c.conceptId), `${c.id} references unknown ${c.conceptId}`).toBe(true);
    }
  });

  it('guard: each check has at least two options with unique ids, text and why', () => {
    for (const c of checks) {
      expect(c.options.length, `${c.id} option count`).toBeGreaterThanOrEqual(2);
      const optionIds = c.options.map((o) => o.id);
      expect(new Set(optionIds).size, `${c.id} option ids are unique`).toBe(optionIds.length);
      for (const o of c.options) {
        for (const key of Object.keys(o))
          expect(OPTION_KEYS, `${c.id}.${o.id} key ${key}`).toContain(key);
        expect(o.text.trim(), `${c.id}.${o.id} text`).not.toBe('');
        expect(o.why.trim(), `${c.id}.${o.id} why`).not.toBe('');
      }
    }
  });

  it('guard: each why is one or two sentences', () => {
    for (const c of checks) {
      for (const o of c.options) {
        expect(sentenceCount(o.why), `${c.id}.${o.id} why`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('guard: exactly one correct option per check', () => {
    for (const c of checks) {
      expect(
        c.options.filter((o) => o.correct),
        `${c.id} correct options`,
      ).toHaveLength(1);
    }
  });

  it('guard: at least one misconception-tagged option per check', () => {
    for (const c of checks) {
      const tagged = c.options.filter((o) => o.misconceptionId !== undefined);
      expect(tagged.length, `${c.id} misconception-tagged options`).toBeGreaterThanOrEqual(1);
    }
  });

  it('guard: misconception ids are in M1-M8 and M10-M14 (M9 is unused)', () => {
    for (const c of checks) {
      for (const o of c.options) {
        if (o.misconceptionId === undefined) continue;
        expect(MISCONCEPTIONS, `${c.id}.${o.id} misconception`).toContain(o.misconceptionId);
      }
    }
  });

  it('guard: every in-scope misconception is referenced by a concept or a check option', () => {
    const referenced = new Set<MisconceptionId>([
      ...concepts.flatMap((c) => (c.misconception === undefined ? [] : [c.misconception])),
      ...checks.flatMap((c) =>
        c.options.flatMap((o) => (o.misconceptionId === undefined ? [] : [o.misconceptionId])),
      ),
    ]);
    for (const m of MISCONCEPTIONS) {
      expect(referenced.has(m), `${m} is not referenced by any concept or check option`).toBe(true);
    }
  });
});
