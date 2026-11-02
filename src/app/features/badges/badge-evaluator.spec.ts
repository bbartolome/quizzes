import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PracticeService } from '../../core/services/practice.service';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { Concept, KnowledgeBase, QuizManifest, QuizStats } from '../../core/models/quiz.models';
import { CalibrationAnswer } from '../calibration/calibration.models';
import { CalibrationHistoryService } from '../calibration/calibration-history.service';
import { FakePracticeService } from '../../../testing/fake-practice.service';
import { BadgeEvaluator } from './badge-evaluator';

const manifest: QuizManifest = {
  quizzes: [
    { id: 'biases', title: 'Biases', description: '', icon: '', version: 1, order: 1, kind: 'biases' },
    {
      id: 'calibration',
      title: 'Confidence',
      description: '',
      icon: '',
      version: 1,
      order: 2,
      kind: 'calibration',
      format: 'two-way',
    },
  ],
};

const kb: KnowledgeBase = {
  concepts: [
    { id: 'anchoring', name: 'Anchoring', type: 'bias' } as Concept,
  ],
  pairs: [],
};

const emptyStats = (quizId: string): QuizStats => ({
  quizId,
  version: 1,
  perTrait: {},
  streak: 0,
  roundsPlayed: 0,
});

const answer = (confidence: number, correct: boolean): CalibrationAnswer => ({
  itemId: 'i',
  pick: 0,
  confidence,
  correct,
});

/** Thirty answers that qualify knows-what-it-knows: 13 of 15 right at 90, 3 of 15 right at 50. */
const qualifying: CalibrationAnswer[] = [
  ...Array.from({ length: 15 }, (_, i) => answer(90, i < 13)),
  ...Array.from({ length: 15 }, (_, i) => answer(50, i < 3)),
];

describe('BadgeEvaluator', () => {
  let practice: FakePracticeService;
  let quizData: { loadManifest: ReturnType<typeof vi.fn>; loadKnowledgeBase: ReturnType<typeof vi.fn> };
  let history: { allAnswers: ReturnType<typeof vi.fn> };

  function setup(): BadgeEvaluator {
    TestBed.configureTestingModule({
      providers: [
        { provide: PracticeService, useValue: practice },
        { provide: QuizDataService, useValue: quizData },
        { provide: StatsService, useValue: { getStats: vi.fn((id: string) => emptyStats(id)) } },
        { provide: CalibrationHistoryService, useValue: history },
      ],
    });
    return TestBed.inject(BadgeEvaluator);
  }

  beforeEach(() => {
    practice = new FakePracticeService();
    quizData = {
      loadManifest: vi.fn(() => of(manifest)),
      loadKnowledgeBase: vi.fn(() => of(kb)),
    };
    history = {
      allAnswers: vi.fn((id: string) => (id === 'calibration' ? qualifying : [])),
    };
  });

  it('records a newly earned badge once, with its evidence', () => {
    const evaluator = setup();
    let result: { earned: string[]; newlyEarned: string[] } | undefined;
    evaluator.evaluate().subscribe((r) => (result = r));

    expect(practice.recordedBadges.map((b) => b.id)).toEqual(['knows-what-it-knows']);
    expect(practice.recordedBadges[0].evidence.length).toBeGreaterThan(0);
    expect(result).toEqual({
      earned: ['knows-what-it-knows'],
      newlyEarned: ['knows-what-it-knows'],
    });
  });

  it('does not record or report a badge that is already stored, and never revokes it', () => {
    practice.seed({
      badges: { 'knows-what-it-knows': { earnedAt: '2026-10-01T00:00:00.000Z', evidence: 'old' } },
    });
    history.allAnswers.mockReturnValue([]);
    const evaluator = setup();
    let result: { earned: string[]; newlyEarned: string[] } | undefined;
    evaluator.evaluate().subscribe((r) => (result = r));

    expect(practice.recordedBadges).toEqual([]);
    expect(result).toEqual({ earned: ['knows-what-it-knows'], newlyEarned: [] });
  });

  it('loads the manifest and knowledge base once across two evaluations', () => {
    const evaluator = setup();
    evaluator.evaluate().subscribe();
    evaluator.evaluate().subscribe();

    expect(quizData.loadManifest).toHaveBeenCalledTimes(1);
    expect(quizData.loadKnowledgeBase).toHaveBeenCalledTimes(1);
  });

  it('records nothing and keeps the stored badges when the manifest cannot load', () => {
    practice.seed({
      badges: { 'names-the-trap': { earnedAt: '2026-10-01T00:00:00.000Z', evidence: 'old' } },
    });
    quizData.loadManifest.mockReturnValue(throwError(() => new Error('offline')));
    const evaluator = setup();
    let result: { earned: string[]; newlyEarned: string[] } | undefined;
    evaluator.evaluate().subscribe((r) => (result = r));

    expect(practice.recordedBadges).toEqual([]);
    expect(result).toEqual({ earned: ['names-the-trap'], newlyEarned: [] });
  });
});
