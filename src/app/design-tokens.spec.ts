import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8');
const html = readFileSync(`${process.cwd()}/src/index.html`, 'utf8');

// [token, utility stem] pairs from docs/specs/design-system.md §3.2.
const TOKENS: [string, string][] = [
  ['surface', 'surface'],
  ['surface-raised', 'raised'],
  ['surface-sunken', 'sunken'],
  ['border', 'default'],
  ['border-strong', 'strong'],
  ['text', 'text'],
  ['text-muted', 'muted'],
  ['accent', 'accent'],
  ['accent-hover', 'accent-hover'],
  ['on-accent', 'on-accent'],
  ['accent-subtle', 'accent-subtle'],
  ['focus', 'focus'],
  ['success', 'success'],
  ['success-subtle', 'success-subtle'],
  ['danger', 'danger'],
  ['danger-subtle', 'danger-subtle'],
  ['warning', 'warning'],
  ['warning-subtle', 'warning-subtle'],
];

// Type roles from docs/specs/design-system.md §5.
const TYPE_ROLES = [
  'type-title',
  'type-section',
  'type-card',
  'type-eyebrow',
  'type-body',
  'type-detail',
  'type-caption',
  'type-stat',
];

describe('design tokens (S1)', () => {
  it.each(TOKENS)('declares --%s and maps it to the --color-%s utility', (token, stem) => {
    expect(css).toMatch(new RegExp(`--${token}:`));
    expect(css).toContain(`--color-${stem}: var(--${token})`);
  });

  it('declares a dark theme override under prefers-color-scheme', () => {
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
  });

  it('declares color-scheme light dark on :root', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });

  it.each(TYPE_ROLES)('defines the %s type role as a @utility', (role) => {
    expect(css).toMatch(new RegExp(`@utility ${role}\\s*\\{`));
  });

  it('adds the color-scheme meta to index.html', () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
  });

  it('adds one theme-color meta per scheme to index.html', () => {
    expect(html).toMatch(/<meta name="theme-color" media="\(prefers-color-scheme: light\)"/);
    expect(html).toMatch(/<meta name="theme-color" media="\(prefers-color-scheme: dark\)"/);
  });

  // §9: non-text marks meet 3:1 on every surface in both themes. Slate-500 is the shade that does (§3.2 allows a shade change).
  it('sets --border-strong to slate-500 in both themes (§9)', () => {
    expect(css.match(/--border-strong: var\(--color-slate-500\);/g)).toHaveLength(2);
  });

  it('defines @utility glossary-grid with grid-template-columns: 18rem minmax(0, 1fr)', () => {
    expect(css).toMatch(
      /@utility\s+glossary-grid\s*\{[^}]*grid-template-columns:\s*18rem\s+minmax\(0,\s*1fr\)/,
    );
  });
});
