import { describe, expect, it } from 'vitest';
import { QuizManifestEntry } from '../../../core/models/quiz.models';
import manifestJson from '../../../../../public/data/quizzes.json';
import conceptsJson from '../../../../../public/data/quizzes/game-theory/concepts.json';
import tutorialsJson from '../../../../../public/data/quizzes/game-theory/tutorials.json';
import checksJson from '../../../../../public/data/quizzes/game-theory/checks.json';

// Build-time guard over the shipped game-theory content (spec §6.5, the bank-version pattern).
// Each content file's version must equal the manifest entry's version, so a stale file cannot
// be served under a newer manifest.

const manifest = manifestJson as unknown as { quizzes: QuizManifestEntry[] };
const entries = manifest.quizzes.filter((q) => q.kind === 'game-theory');

describe('game-theory content versions', () => {
  it('has exactly one game-theory manifest entry, with the game-theory data path', () => {
    expect(entries).toHaveLength(1);
    expect(entries[0].dataPath).toBe('data/quizzes/game-theory/');
  });

  it.each([
    ['concepts.json', conceptsJson],
    ['tutorials.json', tutorialsJson],
    ['checks.json', checksJson],
  ])('%s has the same version as the manifest entry', (_name, file) => {
    expect(file.version).toBe(entries[0].version);
  });
});
