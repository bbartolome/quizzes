import { Injectable } from '@angular/core';

/**
 * Owns `stats:game-theory:games`, the `GamesLog` shape in lib/state.types.ts (§10).
 * Inert in T2: no read or write methods yet. G20 adds them and keeps the injection point.
 */
@Injectable({ providedIn: 'root' })
export class GtGamesService {}
