import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { PracticeService } from '../../core/services/practice.service';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { StatsService } from '../../core/services/stats.service';
import { KnowledgeBase, QuizManifest } from '../../core/models/quiz.models';
import { badgesToRecord, BadgeSource } from '../../core/utils/badge-context';
import { CalibrationHistoryService } from '../calibration/calibration-history.service';
import { formatOf } from '../calibration/calibration-format';

export interface BadgeEvaluation {
  /** Every badge id stored after this evaluation (earlier ones plus newly earned). */
  earned: string[];
  /** Ids recorded by this evaluation. */
  newlyEarned: string[];
}

/**
 * Gathers the real data for the cross-quiz badges and records the newly earned ones.
 * Called on library load and on results screens, never per answer (practice-layer.md §8).
 * A failed load records nothing and resolves with the stored badges.
 */
@Injectable({ providedIn: 'root' })
export class BadgeEvaluator {
  private readonly quizData = inject(QuizDataService);
  private readonly stats = inject(StatsService);
  private readonly calibration = inject(CalibrationHistoryService);
  private readonly practice = inject(PracticeService);

  evaluate(): Observable<BadgeEvaluation> {
    return this.quizData.loadManifest().pipe(
      switchMap((manifest) =>
        this.quizData.loadKnowledgeBase().pipe(map((kb) => this.run(manifest, kb))),
      ),
      catchError(() => of(this.stored([]))),
    );
  }

  private run(manifest: QuizManifest, kb: KnowledgeBase): BadgeEvaluation {
    const stored = this.practice.badges();
    const source: BadgeSource = {
      concepts: kb.concepts,
      pairs: kb.pairs,
      stats: manifest.quizzes
        .filter((e) => e.kind !== 'calibration')
        .map((e) => this.stats.getStats(e.id)),
      conceptDays: this.practice.conceptDays(),
      calibration: manifest.quizzes
        .filter((e) => e.kind === 'calibration')
        .flatMap((e) => {
          const format = formatOf(e);
          return this.calibration
            .allAnswers(e.id)
            .map((a) => ({ confidence: a.confidence, correct: a.correct, format }));
        }),
    };
    const records = badgesToRecord(source, stored);
    this.practice.recordBadges(records);
    return this.stored(records.map((r) => r.id));
  }

  private stored(newlyEarned: string[]): BadgeEvaluation {
    const earned = new Set([...Object.keys(this.practice.badges()), ...newlyEarned]);
    return { earned: [...earned], newlyEarned };
  }
}
