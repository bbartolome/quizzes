import { describe, it, expect } from 'vitest';
import { GAME_THEORY_ROUTES } from './game-theory.routes';
import { GAME_THEORY_MODES } from './modes';
import { CardsPage } from './pages/cards/cards-page';
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

  it('dispatches cards to CardsPage', () => {
    const cards = GAME_THEORY_ROUTES.find((r) => r.path === 'cards');
    expect(cards?.component).toBe(CardsPage);
  });

  it('lists Cards on the hub, at the route path, with no requirement', () => {
    expect(GAME_THEORY_MODES).toContainEqual({
      id: 'cards',
      title: 'Cards',
      path: 'game-theory/cards',
      requires: [],
    });
  });
});
