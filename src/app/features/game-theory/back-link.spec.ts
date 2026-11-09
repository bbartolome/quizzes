import { describe, it, expect } from 'vitest';
import { GAME_THEORY_BACK } from './back-link';

describe('GAME_THEORY_BACK', () => {
  it('reads "← Back to Game Theory" and goes to the hub, for every Game Theory sub-page', () => {
    expect(GAME_THEORY_BACK).toEqual({ label: '← Back to Game Theory', link: '/game-theory' });
  });
});
