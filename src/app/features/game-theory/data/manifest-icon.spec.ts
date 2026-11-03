import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../../../../public/data/quizzes.json';

// Build-time guard: the game-theory manifest entry points at an icon file that ships in public/.
// The manifest lists `icon` as required, so a missing file would be a broken reference.

const manifest = manifestJson as unknown as { quizzes: { kind: string; icon: string }[] };

describe('game-theory manifest icon', () => {
  it('points at an icon file that exists under public/', () => {
    const entry = manifest.quizzes.find((q) => q.kind === 'game-theory');
    expect(entry).toBeDefined();
    expect(existsSync(join(process.cwd(), 'public', entry!.icon))).toBe(true);
  });
});
