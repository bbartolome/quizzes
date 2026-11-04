import type { Type } from '@angular/core';
import { BeautyContestPage } from './pages/play/beauty-contest/beauty-contest-page';

/**
 * Game id (the :game route segment) to the component that plays it.
 * G24 adds beauty-contest; G26 adds the three auction entries. Each lane adds one line here.
 */
export const PLAY_GAMES: Readonly<Record<string, Type<unknown>>> = {
  'beauty-contest': BeautyContestPage,
};
