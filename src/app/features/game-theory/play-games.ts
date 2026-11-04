import type { Type } from '@angular/core';
import { AuctionPage } from './pages/play/auction/auction-page';
import { BeautyContestPage } from './pages/play/beauty-contest/beauty-contest-page';

/**
 * Game id (the :game route segment) to the component that plays it.
 * G24 added beauty-contest; G26 adds the three auction entries, which share one page. Each lane adds one line here.
 */
export const PLAY_GAMES: Readonly<Record<string, Type<unknown>>> = {
  'beauty-contest': BeautyContestPage,
  'first-price': AuctionPage,
  'second-price': AuctionPage,
  'common-value': AuctionPage,
};
