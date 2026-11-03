import { InjectionToken } from '@angular/core';
import type { Rng } from '../lib/rng.types';

/** Pages draw from this token. Tests override it with scripted or seeded rngs. */
export const GAME_THEORY_RNG = new InjectionToken<Rng>('GAME_THEORY_RNG', {
  providedIn: 'root',
  factory: () => Math.random,
});
