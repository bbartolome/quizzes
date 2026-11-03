import { describe, it, expect } from 'vitest';
import { GAME_THEORY_ROUTES } from './game-theory.routes';
import { GameTheoryHomePage } from './pages/home/game-theory-home-page';

describe('GAME_THEORY_ROUTES', () => {
  it('registers the hub at the empty path', () => {
    const hub = GAME_THEORY_ROUTES.find((r) => r.path === '');
    expect(hub?.component).toBe(GameTheoryHomePage);
  });
});
