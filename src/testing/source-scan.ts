import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every non-spec .ts file under dir, recursively. Paths are absolute when dir is. */
export function productionTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...productionTsFiles(path));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      files.push(path);
    }
  }
  return files;
}

/** The text of a file with `//` line comments removed, so a comment cannot trip a code rule. */
export function codeLines(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''));
}

/** Module specifiers in a file (import, export from, dynamic import), with 1-based line numbers. */
export function importSpecifiers(file: string): { specifier: string; line: number }[] {
  const found: { specifier: string; line: number }[] = [];
  const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  codeLines(file).forEach((text, index) => {
    for (const match of text.matchAll(pattern)) {
      found.push({ specifier: match[1], line: index + 1 });
    }
  });
  return found;
}
