import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { QuizManifest } from './quiz.models';

describe('quiz manifest (S11, §11)', () => {
  it('has no per-quiz accent on any entry', () => {
    const manifest: QuizManifest = JSON.parse(
      readFileSync(`${process.cwd()}/public/data/quizzes.json`, 'utf8'),
    );
    const withAccent = manifest.quizzes
      .filter((entry) => 'accent' in entry)
      .map((entry) => entry.id);

    expect(withAccent).toEqual([]);
  });
});
