import { describe, it, expect } from 'vitest';
import { GAME_THEORY_ROUTES } from './game-theory.routes';
import { GameTheoryHomePage } from './pages/home/game-theory-home-page';
import { PlayPage } from './pages/play/play-page';
import { TestOutPage } from './pages/test-out/test-out-page';

describe('GAME_THEORY_ROUTES', () => {
  it('registers the hub at the empty path', () => {
    const hub = GAME_THEORY_ROUTES.find((r) => r.path === '');
    expect(hub?.component).toBe(GameTheoryHomePage);
  });

  it('dispatches play/:game to PlayPage', () => {
    const play = GAME_THEORY_ROUTES.find((r) => r.path === 'play/:game');
    expect(play?.component).toBe(PlayPage);
  });

  it('dispatches test-out/:concept to TestOutPage', () => {
    const testOut = GAME_THEORY_ROUTES.find((r) => r.path === 'test-out/:concept');
    expect(testOut?.component).toBe(TestOutPage);
  });
});
