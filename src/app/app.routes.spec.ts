import { describe, it, expect } from 'vitest';
import { routes } from './app.routes';
import { LibraryPage } from './features/library/library-page';
import { QuizHomePage } from './features/quiz-home/quiz-home-page';
import { RoundPage } from './features/round/round-page';
import { ReportPage } from './features/report/report-page';
import { GlossaryPage } from './features/glossary/glossary-page';
import { StatsPage } from './features/stats/stats-page';

describe('routes', () => {
  it('has exactly 7 route entries', () => {
    expect(routes.length).toBe(7);
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

  it('redirects unmatched paths ("**") to the empty path', () => {
    const route = routes.find((r) => r.path === '**');
    expect(route?.redirectTo).toBe('');
  });

  it('declares the wildcard route last', () => {
    expect(routes[routes.length - 1].path).toBe('**');
  });
});
