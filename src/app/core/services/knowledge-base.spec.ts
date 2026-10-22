import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const KB_PATH = 'public/data/concepts/knowledge-base.json';
const MANIFEST_PATH = 'public/data/quizzes.json';

function readJson(path: string): any {
  return JSON.parse(readFileSync(`${process.cwd()}/${path}`, 'utf8'));
}

const REQUIRED_CONCEPT_KEYS = ['id', 'name', 'type', 'shortDefinition', 'longExplanation', 'example'];
const OPTIONAL_CONCEPT_KEYS = ['spottingTip'];

describe('knowledge base (S1)', () => {
  it('exists at the fixed concepts path', () => {
    expect(() => readJson(KB_PATH)).not.toThrow();
  });

  it('has shape { concepts, pairs }', () => {
    const kb = readJson(KB_PATH);
    expect(Object.keys(kb).sort()).toEqual(['concepts', 'pairs']);
    expect(Array.isArray(kb.concepts)).toBe(true);
    expect(Array.isArray(kb.pairs)).toBe(true);
  });

  it('concepts have the required keys and only allowed extras', () => {
    const allowed = [...REQUIRED_CONCEPT_KEYS, ...OPTIONAL_CONCEPT_KEYS];
    for (const c of readJson(KB_PATH).concepts) {
      for (const key of REQUIRED_CONCEPT_KEYS) expect(c).toHaveProperty(key);
      for (const key of Object.keys(c)) expect(allowed).toContain(key);
      expect(['bias', 'fallacy']).toContain(c.type);
    }
  });

  it('pairs are { concepts: [a, b], tip? } with no other keys', () => {
    for (const p of readJson(KB_PATH).pairs) {
      expect(p.concepts).toHaveLength(2);
      for (const key of Object.keys(p)) expect(['concepts', 'tip']).toContain(key);
    }
  });

  it('guard: concept ids are unique', () => {
    const ids = readJson(KB_PATH).concepts.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('guard: pairs reference existing concept ids', () => {
    const kb = readJson(KB_PATH);
    const ids = new Set(kb.concepts.map((c: { id: string }) => c.id));
    for (const p of kb.pairs) {
      for (const id of p.concepts) expect(ids.has(id), `unknown id ${id}`).toBe(true);
    }
  });

  it('guard: no self-pairs', () => {
    for (const p of readJson(KB_PATH).pairs) {
      expect(p.concepts[0]).not.toBe(p.concepts[1]);
    }
  });

  it('guard: no duplicate pairs in either order', () => {
    const seen = new Set<string>();
    for (const p of readJson(KB_PATH).pairs) {
      const key = [...p.concepts].sort().join('|');
      expect(seen.has(key), `duplicate pair ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('manifest bumps reasoning-traps to version 2', () => {
    const entry = readJson(MANIFEST_PATH).quizzes.find(
      (e: { id: string }) => e.id === 'reasoning-traps',
    );
    expect(entry.version).toBe(2);
  });
});
