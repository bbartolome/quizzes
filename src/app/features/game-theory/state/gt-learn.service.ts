import { Injectable } from '@angular/core';

/**
 * Owns `stats:game-theory:learn`, the `LearnState` shape in lib/state.types.ts (§10).
 * Inert in T2: no read or write methods yet. G9 adds them and keeps the injection point.
 */
@Injectable({ providedIn: 'root' })
export class GtLearnService {}
