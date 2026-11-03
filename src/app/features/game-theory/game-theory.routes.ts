import { Routes } from '@angular/router';
import { GameTheoryHomePage } from './pages/home/game-theory-home-page';
import { PlayPage } from './pages/play/play-page';

/**
 * Child routes under `game-theory`, mounted once in app.routes.ts. Each later slice appends its
 * own row here, so slices do not edit the top-level route table (spec §3.2, T5).
 */
export const GAME_THEORY_ROUTES: Routes = [
  { path: '', component: GameTheoryHomePage },
  { path: 'play/:game', component: PlayPage },
];
