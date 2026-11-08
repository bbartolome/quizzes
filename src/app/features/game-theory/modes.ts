/**
 * One entry per mode on the hub's mode list. Lanes append one line each (G10, G16, G20, G24).
 * `path` is the route without a leading slash, for example 'game-theory/cards'.
 * `requires` lists the concept ids that must be introduced before the mode shows. [] means always open.
 * It is a hint, not a lock: access is never locked (spec §11).
 */
export interface GameTheoryMode {
  id: string;
  title: string;
  path: string;
  requires: string[];
}

export const GAME_THEORY_MODES: readonly GameTheoryMode[] = [
  { id: 'cards', title: 'Cards', path: 'game-theory/cards', requires: [] },
  {
    id: 'puzzles-equilibrium',
    title: 'Equilibrium puzzles',
    path: 'game-theory/puzzles/equilibrium',
    requires: ['nash-equilibrium'],
  },
  {
    id: 'puzzles-classify',
    title: 'Classify puzzles',
    path: 'game-theory/puzzles/classify',
    requires: ['nash-equilibrium'],
  },
  {
    id: 'puzzles-eliminate',
    title: 'Eliminate puzzles',
    path: 'game-theory/puzzles/eliminate',
    requires: ['nash-equilibrium'],
  },
  {
    id: 'puzzles-mixed',
    title: 'Mixed puzzles',
    path: 'game-theory/puzzles/mixed',
    requires: ['nash-equilibrium'],
  },
  { id: 'bots-play', title: 'Bots', path: 'game-theory/bots/play', requires: [] },
  { id: 'bots-name', title: 'Name the bot', path: 'game-theory/bots/name', requires: [] },
  { id: 'bots-tournament', title: 'Tournament', path: 'game-theory/bots/tournament', requires: [] },
  {
    id: 'beauty-contest',
    title: 'Beauty contest',
    path: 'game-theory/play/beauty-contest',
    requires: [],
  },
  {
    id: 'auction-first-price',
    title: 'First-price auction',
    path: 'game-theory/play/first-price',
    requires: [],
  },
  {
    id: 'auction-second-price',
    title: 'Second-price auction',
    path: 'game-theory/play/second-price',
    requires: [],
  },
  {
    id: 'auction-common-value',
    title: 'Common-value auction',
    path: 'game-theory/play/common-value',
    requires: [],
  },
];
