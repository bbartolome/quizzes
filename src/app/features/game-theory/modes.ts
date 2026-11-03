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

export const GAME_THEORY_MODES: readonly GameTheoryMode[] = [];
