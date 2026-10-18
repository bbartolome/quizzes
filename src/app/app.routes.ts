import { Routes } from '@angular/router';
import { LibraryPage } from './features/library/library-page';
import { QuizHomePage } from './features/quiz-home/quiz-home-page';
import { RoundPage } from './features/round/round-page';
import { ReportPage } from './features/report/report-page';
import { GlossaryPage } from './features/glossary/glossary-page';
import { StatsPage } from './features/stats/stats-page';
import { CalibrationRoundPrototypePage } from './features/calibration-round-prototype/calibration-round-prototype-page';

export const routes: Routes = [
  { path: '', component: LibraryPage },
  { path: 'quiz/:id', component: QuizHomePage },
  { path: 'quiz/:id/round', component: RoundPage },
  { path: 'quiz/:id/report', component: ReportPage },
  { path: 'quiz/:id/glossary', component: GlossaryPage },
  { path: 'quiz/:id/stats', component: StatsPage },
  { path: 'prototype/calibration-round', component: CalibrationRoundPrototypePage }, // PROTOTYPE
  { path: '**', redirectTo: '' },
];
