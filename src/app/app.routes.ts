import { Routes } from '@angular/router';
import { LibraryPage } from './features/library/library-page';
import { QuizHomePage } from './features/quiz-home/quiz-home-page';
import { RoundPage } from './features/round/round-page';
import { ReportPage } from './features/report/report-page';
import { GlossaryPage } from './features/glossary/glossary-page';
import { StatsPage } from './features/stats/stats-page';
import { CalibrationHomePage } from './features/calibration/calibration-home-page';
import { CalibrationRoundPage } from './features/calibration/calibration-round-page';
import { CalibrationResultsPage } from './features/calibration/calibration-results-page';

export const routes: Routes = [
  { path: '', component: LibraryPage },
  { path: 'quiz/:id', component: QuizHomePage },
  { path: 'quiz/:id/round', component: RoundPage },
  { path: 'quiz/:id/report', component: ReportPage },
  { path: 'quiz/:id/glossary', component: GlossaryPage },
  { path: 'quiz/:id/stats', component: StatsPage },
  { path: 'calibration/:id', component: CalibrationHomePage },
  { path: 'calibration/:id/round', component: CalibrationRoundPage },
  { path: 'calibration/:id/results', component: CalibrationResultsPage },
  { path: '**', redirectTo: '' },
];
