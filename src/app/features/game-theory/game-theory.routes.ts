import { Routes } from '@angular/router';
import { BotsPage } from './pages/bots/bots-page';
import { CardsPage } from './pages/cards/cards-page';
import { GameTheoryHomePage } from './pages/home/game-theory-home-page';
import { TutorialPage } from './pages/tutorial/tutorial-page';
import { PlayPage } from './pages/play/play-page';
import { PuzzleSetPage } from './pages/puzzle-set/puzzle-set-page';
import { TestOutPage } from './pages/test-out/test-out-page';

/**
 * Child routes under `game-theory`, mounted once in app.routes.ts. Each later slice appends its
 * own row here, so slices do not edit the top-level route table (spec §3.2, T5).
 */
export const GAME_THEORY_ROUTES: Routes = [
  { path: '', component: GameTheoryHomePage },
  { path: 'cards', component: CardsPage },
  { path: 'learn/:concept', component: TutorialPage },
  { path: 'play/:game', component: PlayPage },
  { path: 'test-out/:concept', component: TestOutPage },
  { path: 'puzzles/:kind', component: PuzzleSetPage },
  { path: 'bots/:mode', component: BotsPage },
];
