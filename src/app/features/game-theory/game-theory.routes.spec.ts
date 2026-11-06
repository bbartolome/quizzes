import { describe, it, expect } from 'vitest';
import { GAME_THEORY_ROUTES } from './game-theory.routes';
import { GAME_THEORY_MODES } from './modes';
import { BotsPage } from './pages/bots/bots-page';
import { CardsPage } from './pages/cards/cards-page';
import { GameTheoryHomePage } from './pages/home/game-theory-home-page';
import { PlayPage } from './pages/play/play-page';
import { PuzzleSetPage } from './pages/puzzle-set/puzzle-set-page';
import { TutorialPage } from './pages/tutorial/tutorial-page';

describe('GAME_THEORY_ROUTES', () => {
  it('registers the hub at the empty path', () => {
    const hub = GAME_THEORY_ROUTES.find((r) => r.path === '');
    expect(hub?.component).toBe(GameTheoryHomePage);
  });

  it('dispatches play/:game to PlayPage', () => {
    const play = GAME_THEORY_ROUTES.find((r) => r.path === 'play/:game');
    expect(play?.component).toBe(PlayPage);
  });

  it('dispatches learn/:concept to TutorialPage', () => {
    const learn = GAME_THEORY_ROUTES.find((r) => r.path === 'learn/:concept');
    expect(learn?.component).toBe(TutorialPage);
  });

  it('dispatches cards to CardsPage', () => {
    const cards = GAME_THEORY_ROUTES.find((r) => r.path === 'cards');
    expect(cards?.component).toBe(CardsPage);
  });

  it('dispatches puzzles/:kind to PuzzleSetPage', () => {
    const puzzles = GAME_THEORY_ROUTES.find((r) => r.path === 'puzzles/:kind');
    expect(puzzles?.component).toBe(PuzzleSetPage);
  });

  it('dispatches bots/:mode to BotsPage', () => {
    const bots = GAME_THEORY_ROUTES.find((r) => r.path === 'bots/:mode');
    expect(bots?.component).toBe(BotsPage);
  });

  it('lists the Bots play mode on the hub, at the route path, with no requirement', () => {
    expect(GAME_THEORY_MODES).toContainEqual({
      id: 'bots-play',
      title: 'Bots',
      path: 'game-theory/bots/play',
      requires: [],
    });
  });

  it('lists Name the bot on the hub, at the route path, with no requirement', () => {
    expect(GAME_THEORY_MODES).toContainEqual({
      id: 'bots-name',
      title: 'Name the bot',
      path: 'game-theory/bots/name',
      requires: [],
    });
  });

  it('lists Tournament on the hub, at the route path, with no requirement', () => {
    expect(GAME_THEORY_MODES).toContainEqual({
      id: 'bots-tournament',
      title: 'Tournament',
      path: 'game-theory/bots/tournament',
      requires: [],
    });
  });

  it('lists Cards on the hub, at the route path, with no requirement', () => {
    expect(GAME_THEORY_MODES).toContainEqual({
      id: 'cards',
      title: 'Cards',
      path: 'game-theory/cards',
      requires: [],
    });
  });

  it('lists one puzzle set per kind on the hub, each requiring nash-equilibrium', () => {
    const sets = [
      { id: 'puzzles-equilibrium', title: 'Equilibrium puzzles', kind: 'equilibrium' },
      { id: 'puzzles-classify', title: 'Classify puzzles', kind: 'classify' },
      { id: 'puzzles-eliminate', title: 'Eliminate puzzles', kind: 'eliminate' },
      { id: 'puzzles-mixed', title: 'Mixed puzzles', kind: 'mixed' },
    ];
    for (const set of sets) {
      expect(GAME_THEORY_MODES).toContainEqual({
        id: set.id,
        title: set.title,
        path: `game-theory/puzzles/${set.kind}`,
        requires: ['nash-equilibrium'],
      });
    }
  });
});
