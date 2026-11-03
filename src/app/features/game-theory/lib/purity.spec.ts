import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeLines, productionTsFiles } from '../../../../testing/source-scan';

// Build-time guard: lib/ is pure TypeScript, so it runs the same in tests, Node and the browser.
// Spec §3.3 and §4.2. Every lane inherits this guard from its first commit.

const LIB = join(process.cwd(), 'src/app/features/game-theory/lib');

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: "import from '@angular/'", pattern: /(?:\bfrom\s+|\bimport\s+)['"]@angular\// },
  { name: 'Math.random', pattern: /\bMath\.random\b/ },
  { name: 'Date.now', pattern: /\bDate\.now\b/ },
  { name: 'new Date() with no argument', pattern: /\bnew\s+Date\s*\(\s*\)/ },
  { name: 'localStorage', pattern: /\blocalStorage\b/ },
];

/** Every violation in one file, as "path:line rule". */
function violationsIn(file: string): string[] {
  const found: string[] = [];
  codeLines(file).forEach((text, index) => {
    for (const rule of BANNED) {
      if (rule.pattern.test(text)) {
        found.push(`${relative(process.cwd(), file)}:${index + 1} ${rule.name}`);
      }
    }
  });
  return found;
}

describe('lib purity', () => {
  const files = productionTsFiles(LIB);

  it('finds the lib sources it guards, so it cannot pass on an empty scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no banned import or API in any non-spec lib file', () => {
    const violations = files.flatMap(violationsIn);
    expect(violations).toEqual([]);
  });
});

describe('purity scanner', () => {
  it.each([
    ["import { Injectable } from '@angular/core';", "import from '@angular/'"],
    ['const r = Math.random();', 'Math.random'],
    ['const t = Date.now();', 'Date.now'],
    ['const d = new Date();', 'new Date() with no argument'],
    ['const s = localStorage.getItem("k");', 'localStorage'],
  ])('flags %s as %s', (sample, rule) => {
    const pattern = BANNED.find((b) => b.name === rule)?.pattern;
    expect(pattern?.test(sample)).toBe(true);
  });

  it('allows a dated Date, and a banned name inside a comment', () => {
    const allowed = [
      'const d = new Date(0);',
      'const epoch = new Date(2026, 0, 1);',
      "import type { Rng } from './rng.types';",
    ];
    for (const sample of allowed) {
      for (const rule of BANNED) {
        expect(rule.pattern.test(sample)).toBe(false);
      }
    }
    const commented = 'const x = 1; // Math.random is banned here';
    const [code] = commented.split(/\/\/.*$/);
    expect(BANNED.some((b) => b.pattern.test(code))).toBe(false);
  });
});
