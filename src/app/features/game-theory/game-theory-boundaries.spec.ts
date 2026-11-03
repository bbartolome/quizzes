import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSpecifiers, productionTsFiles } from '../../../testing/source-scan';

// Build-time guard on what game-theory may import. Spec §3.3.
// game-theory may import core/**, shared/ui/**, the three flash-card helpers and glossary-search.
// It must not import the six feature folders below, which would couple it to other quizzes.

const FEATURES = join(process.cwd(), 'src/app/features');
const GAME_THEORY = join(FEATURES, 'game-theory');

const FORBIDDEN_FEATURES = ['round', 'report', 'calibration', 'quiz-home', 'library', 'stats'].map(
  (name) => join(FEATURES, name),
);

/** Returns the rule a relative import breaks, or null. Bare specifiers (npm, Angular) are not checked. */
export function boundaryViolation(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const target = resolve(dirname(fromFile), specifier);
  for (const forbidden of FORBIDDEN_FEATURES) {
    if (target === forbidden || target.startsWith(forbidden + sep)) {
      return `imports ${relative(process.cwd(), forbidden)}`;
    }
  }
  return null;
}

describe('game-theory boundaries', () => {
  const files = productionTsFiles(GAME_THEORY);

  it('scans real game-theory sources, so it cannot pass on an empty folder', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('keeps every game-theory import out of the forbidden feature folders', () => {
    const violations = files.flatMap((file) =>
      importSpecifiers(file).flatMap(({ specifier, line }) => {
        const rule = boundaryViolation(file, specifier);
        return rule ? [`${relative(process.cwd(), file)}:${line} ${rule}`] : [];
      }),
    );
    expect(violations).toEqual([]);
  });

  it('flags an import of a forbidden feature and allows the permitted ones', () => {
    const from = join(GAME_THEORY, 'pages', 'home', 'home.ts');
    expect(boundaryViolation(from, '../../../library/library-cards')).toMatch(/imports .*library/);
    expect(boundaryViolation(from, '../../../calibration/scoring')).toMatch(/imports .*calibration/);
    expect(boundaryViolation(from, '../../../../core/models/quiz.models')).toBeNull();
    expect(boundaryViolation(from, '../../../flash-cards/card-builder')).toBeNull();
    expect(boundaryViolation(from, '../../../glossary/glossary-search')).toBeNull();
    expect(boundaryViolation(from, '@angular/core')).toBeNull();
  });
});
