import { computed, inject, Injectable, signal } from '@angular/core';
import type { ScoredQuestionResult } from '../../../core/models/quiz.models';
import { PracticeService } from '../../../core/services/practice.service';
import { StatsService } from '../../../core/services/stats.service';
import { countOf, EVIDENCE_QUIZ_IDS, GtLearnService } from './gt-learn.service';

/** Which stats key a scored attempt is written to: card checks or challenges (§10). */
export type GtFacet = 'cards' | 'challenges';

const PRACTICE_QUIZ_ID = 'game-theory';

/** A stored stats version is valid if it is a non-negative integer no newer than the content. */
function isKnownVersion(stored: number, contentVersion: number): boolean {
  return Number.isInteger(stored) && stored >= 0 && stored <= contentVersion;
}

/** Synthesises the ScoredQuestionResult that StatsService.recordResult expects (§10). */
function scored(conceptIds: string[], correct: boolean): ScoredQuestionResult {
  return {
    question: {
      id: conceptIds.join('+'),
      prompt: '',
      options: [],
      correctAnswers: [],
      traitIds: conceptIds,
      explanation: '',
    },
    selected: correct ? conceptIds : [],
    correct,
    missed: correct ? [] : conceptIds,
    extra: [],
  };
}

/**
 * Single write path for scored attempts (§9.1). Writes are best-effort: a failure is caught,
 * never thrown, and surfaces through `saveFailed` so the page can show it.
 */
@Injectable({ providedIn: 'root' })
export class GtEvidenceService {
  private readonly stats = inject(StatsService);
  private readonly practice = inject(PracticeService);
  private readonly learn = inject(GtLearnService);
  private readonly ownFailed = signal(false);
  /** Card checks since the last session end, so an empty session does not count as a round. */
  private cardChecks = 0;

  /** True when a write from this service failed, or the learn or practice write it triggers did. */
  readonly saveFailed = computed(
    () => this.ownFailed() || this.learn.saveFailed() || this.practice.saveFailed(),
  );

  /** A scored attempt. Credits each concept id; a two-concept puzzle passes both. */
  record(conceptIds: string[], correct: boolean, facet: GtFacet, now: Date): void {
    try {
      const quizId = EVIDENCE_QUIZ_IDS[facet];
      this.repairIfCorrupt(quizId);
      this.stats.recordResult(quizId, scored(conceptIds, correct));
      if (facet === 'cards') {
        this.cardChecks += 1;
      }
      this.practice.recordAttempt(PRACTICE_QUIZ_ID, { conceptIds: [...conceptIds], count: 1 }, now);
      this.learn.refresh();
      this.ownFailed.set(false);
    } catch {
      this.ownFailed.set(true);
    }
  }

  /** A daily puzzle answer. Also makes the day a practice day (§9.1). */
  recordDaily(now: Date): void {
    try {
      this.practice.recordDaily(now);
      this.ownFailed.set(false);
    } catch {
      this.ownFailed.set(true);
    }
  }

  /** End of a card session, if at least one card was checked (§10). */
  recordSessionEnd(): void {
    if (this.cardChecks === 0) {
      return;
    }
    // Reset before the write, so a failed write cannot carry the count into the next session.
    this.cardChecks = 0;
    try {
      this.stats.recordSessionEnd(EVIDENCE_QUIZ_IDS.cards);
      this.ownFailed.set(false);
    } catch {
      this.ownFailed.set(true);
    }
  }

  /** Runs on every hub load: migrates both stats keys and prunes removed concept ids (§10). */
  migrateContent(version: number, conceptIds: string[]): void {
    try {
      for (const quizId of [EVIDENCE_QUIZ_IDS.cards, EVIDENCE_QUIZ_IDS.challenges]) {
        // An unknown or future stored version is corrupt, so the key starts again at zero.
        if (!isKnownVersion(this.stats.getStats(quizId).version, version)) {
          this.stats.resetQuiz(quizId);
        }
        this.stats.migrateVersion(quizId, version, conceptIds);
      }
      this.learn.refresh(conceptIds);
      this.ownFailed.set(false);
    } catch {
      this.ownFailed.set(true);
    }
  }

  /**
   * StatsService.recordResult adds to each stored per-concept entry, so one malformed entry would
   * persist NaN or a negative count. If any entry is malformed, the key starts again at zero.
   */
  private repairIfCorrupt(quizId: string): void {
    const { perTrait } = this.stats.getStats(quizId);
    if (Object.values(perTrait).some((entry) => countOf(entry) === null)) {
      this.stats.resetQuiz(quizId);
    }
  }
}
