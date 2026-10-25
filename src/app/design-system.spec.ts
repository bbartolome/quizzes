import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(process.cwd(), 'src/app');

// Feature folders not migrated to the design system yet (docs/specs/design-system.md §10).
// Each migration slice removes its folder; S11 asserts the list is empty and deletes it.
const ALLOWLIST: string[] = [];

const PALETTE =
  /(bg|text|border|ring|fill|stroke|from|via|to|divide|outline|accent|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+|\bbg-white\b|\bbg-black\b|\btext-white\b|ring-black\//;
const HEX_IN_ATTRIBUTE = /="[^"]*#[0-9a-fA-F]{3,8}\b[^"]*"/;
const NAMED_SVG_COLOR = /\b(fill|stroke)="(?!none"|currentColor")[a-zA-Z]+"/;
const ARBITRARY_VALUE = /\b(text|bg|border)-\[/;
const COLOR_STYLE_BINDING = /\[style\.(color|backgroundColor|borderColor|borderLeftColor|fill|stroke)\]|\[style\.[^\]]+\]="[^"]*accent/;
const DARK_VARIANT = /(^|[\s"'`])dark:/;
const HEX_ANYWHERE = /#[0-9a-fA-F]{3,8}\b/;
const STYLE_PROPERTY = /(^|[\s;{])(background(-color)?|color|border-radius)\s*:/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Lines (1-based) of every inline template: block in a .ts file.
function templateBlocks(text: string): { firstLine: number; body: string }[] {
  const blocks: { firstLine: number; body: string }[] = [];
  const pattern = /template:\s*`([^`]*)`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const firstLine = text.slice(0, match.index).split('\n').length;
    blocks.push({ firstLine, body: match[1] });
  }
  return blocks;
}

// Lines (1-based) inside each styles: block of a .ts file (array or template literal form).
function styleBlocks(text: string): { firstLine: number; body: string }[] {
  const blocks: { firstLine: number; body: string }[] = [];
  const pattern = /styles:\s*(\[[\s\S]*?\]|`[^`]*`)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const firstLine = text.slice(0, match.index).split('\n').length;
    blocks.push({ firstLine, body: match[1] });
  }
  return blocks;
}

function linesOf(text: string, firstLine: number): { line: number; text: string }[] {
  return text.split('\n').map((value, index) => ({ line: firstLine + index, text: value }));
}

function violationsIn(file: string): string[] {
  const rel = relative(process.cwd(), file);
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];
  const check = (line: number, source: string) => {
    if (PALETTE.test(source)) found.push(`${rel}:${line} raw palette class`);
    if (HEX_IN_ATTRIBUTE.test(source)) found.push(`${rel}:${line} hex color in attribute`);
    if (NAMED_SVG_COLOR.test(source)) found.push(`${rel}:${line} named SVG color`);
    if (ARBITRARY_VALUE.test(source)) found.push(`${rel}:${line} arbitrary size or color value`);
    if (COLOR_STYLE_BINDING.test(source)) found.push(`${rel}:${line} color style binding`);
    if (DARK_VARIANT.test(source)) found.push(`${rel}:${line} dark: variant`);
  };

  if (file.endsWith('.html')) {
    linesOf(text, 1).forEach(({ line, text: source }) => check(line, source));
    return found;
  }

  templateBlocks(text).forEach(({ firstLine, body }) =>
    linesOf(body, firstLine).forEach(({ line, text: source }) => check(line, source)),
  );
  styleBlocks(text).forEach(({ firstLine, body }) =>
    linesOf(body, firstLine).forEach(({ line, text: source }) => {
      if (HEX_ANYWHERE.test(source)) found.push(`${rel}:${line} hex color in styles`);
      if (STYLE_PROPERTY.test(source)) found.push(`${rel}:${line} styles: sets background, color or border-radius`);
    }),
  );
  return found;
}

function isAllowlisted(file: string): boolean {
  const rel = relative(APP_DIR, file);
  return ALLOWLIST.some((folder) => rel.startsWith(`features/${folder}/`));
}

describe('design system guard (S2, §10)', () => {
  it('reports no raw palette, hex, arbitrary, style-binding, dark: or styles: violations outside the allowlist', () => {
    const files = walk(APP_DIR).filter(
      (file) =>
        (file.endsWith('.html') || (file.endsWith('.ts') && !file.endsWith('.spec.ts'))) &&
        !isAllowlisted(file),
    );
    const violations = files.flatMap(violationsIn);
    expect(violations).toEqual([]);
  });
});
