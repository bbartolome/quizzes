import { describe, it, expect } from 'vitest';
import { routes } from './app.routes';
import { LibraryPage } from './features/library/library-page';
import { QuizHomePage } from './features/quiz-home/quiz-home-page';
import { RoundPage } from './features/round/round-page';
import { ReportPage } from './features/report/report-page';
import { GlossaryPage } from './features/glossary/glossary-page';
import { StatsPage } from './features/stats/stats-page';
import { CalibrationHomePage } from './features/calibration/calibration-home-page';
import { CalibrationRoundPage } from './features/calibration/calibration-round-page';
import { CalibrationResultsPage } from './features/calibration/calibration-results-page';
import { FlashCardHomePage } from './features/flash-cards/flash-card-home-page';
import { FlashCardRoundPage } from './features/flash-cards/flash-card-round-page';

describe('routes', () => {
  it('has exactly 14 route entries', () => {
    expect(routes.length).toBe(14);
  });

  it.each([
    ['biases/:id', 'bias', FlashCardHomePage],
    ['biases/:id/round', 'bias', FlashCardRoundPage],
    ['fallacies/:id', 'fallacy', FlashCardHomePage],
    ['fallacies/:id/round', 'fallacy', FlashCardRoundPage],
  ])('maps "%s" to a flash card page with conceptType %s', (path, conceptType, component) => {
    const route = routes.find((r) => r.path === path);
    expect(route?.component).toBe(component);
    expect(route?.data).toEqual({ conceptType });
  });

  it('maps "" to LibraryPage', () => {
    const route = routes.find((r) => r.path === '');
    expect(route?.component).toBe(LibraryPage);
  });

  it('maps "quiz/:id" to QuizHomePage', () => {
    const route = routes.find((r) => r.path === 'quiz/:id');
    expect(route?.component).toBe(QuizHomePage);
  });

  it('maps "quiz/:id/round" to RoundPage', () => {
    const route = routes.find((r) => r.path === 'quiz/:id/round');
    expect(route?.component).toBe(RoundPage);
  });

  it('maps "quiz/:id/report" to ReportPage', () => {
    const route = routes.find((r) => r.path === 'quiz/:id/report');
    expect(route?.component).toBe(ReportPage);
  });

  it('maps "quiz/:id/glossary" to GlossaryPage', () => {
    const route = routes.find((r) => r.path === 'quiz/:id/glossary');
    expect(route?.component).toBe(GlossaryPage);
  });

  it('maps "quiz/:id/stats" to StatsPage', () => {
    const route = routes.find((r) => r.path === 'quiz/:id/stats');
    expect(route?.component).toBe(StatsPage);
  });

  it('maps "calibration/:id" to CalibrationHomePage', () => {
    const route = routes.find((r) => r.path === 'calibration/:id');
    expect(route?.component).toBe(CalibrationHomePage);
  });

  it('maps "calibration/:id/round" to CalibrationRoundPage', () => {
    const route = routes.find((r) => r.path === 'calibration/:id/round');
    expect(route?.component).toBe(CalibrationRoundPage);
  });

  it('maps "calibration/:id/results" to CalibrationResultsPage', () => {
    const route = routes.find((r) => r.path === 'calibration/:id/results');
    expect(route?.component).toBe(CalibrationResultsPage);
  });

  it('redirects unmatched paths ("**") to the empty path', () => {
    const route = routes.find((r) => r.path === '**');
    expect(route?.redirectTo).toBe('');
  });

  it('declares the wildcard route last', () => {
    expect(routes[routes.length - 1].path).toBe('**');
  });
});
