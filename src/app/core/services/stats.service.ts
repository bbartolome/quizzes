import { Injectable } from '@angular/core';
import { PerTraitStats, QuizStats, ScoredQuestionResult } from '../models/quiz.models';

const KEY_PREFIX = 'stats:';

function storage(): Storage {
  return globalThis.localStorage;
}

function keyFor(quizId: string): string {
  return `${KEY_PREFIX}${quizId}`;
}

function accuracy(stat: PerTraitStats): number {
  return stat.attempted > 0 ? stat.correct / stat.attempted : 0;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  getStats(quizId: string): QuizStats {
    const raw = storage().getItem(keyFor(quizId));
    if (raw === null) {
      return this.zeroed(quizId);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<QuizStats> | null;
      if (!parsed || typeof parsed !== 'object') {
        return this.zeroed(quizId);
      }
      return {
        quizId: quizId,
        version: typeof parsed.version === 'number' ? parsed.version : 0,
        perTrait: parsed.perTrait && typeof parsed.perTrait === 'object' ? parsed.perTrait : {},
        streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
        roundsPlayed:
          typeof parsed.roundsPlayed === 'number' ? parsed.roundsPlayed : 0,
      };
    } catch {
      return this.zeroed(quizId);
    }
  }

  recordResult(quizId: string, result: ScoredQuestionResult): QuizStats {
    const stats = this.getStats(quizId);
    const traitId = result.question.sourceTemplateId ?? result.question.id;

    const existing: PerTraitStats = stats.perTrait[traitId] ?? {
      traitId,
      correct: 0,
      attempted: 0,
    };
    const updated: PerTraitStats = {
      traitId,
      correct: existing.correct + (result.correct ? 1 : 0),
      attempted: existing.attempted + 1,
    };

    stats.perTrait = { ...stats.perTrait, [traitId]: updated };
    stats.streak = result.correct ? stats.streak + 1 : 0;

    this.persist(quizId, stats);
    return stats;
  }

  getWeakTraits(quizId: string, limit?: number): string[] {
    const stats = this.getStats(quizId);
    const traitIds = Object.keys(stats.perTrait);
    const sorted = [...traitIds].sort((a, b) => {
      const delta = accuracy(stats.perTrait[a]) - accuracy(stats.perTrait[b]);
      if (delta !== 0) return delta;
      // Stable tiebreak: fewer attempts first, then lexicographic.
      const attemptDelta = stats.perTrait[a].attempted - stats.perTrait[b].attempted;
      if (attemptDelta !== 0) return attemptDelta;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
      return sorted.slice(0, Math.floor(limit));
    }
    return sorted;
  }

  migrateVersion(quizId: string, version: number, validTraitIds: string[]): QuizStats {
    const stats = this.getStats(quizId);
    const valid = new Set(validTraitIds);
    const perTrait: Record<string, PerTraitStats> = {};
    for (const [traitId, entry] of Object.entries(stats.perTrait)) {
      if (valid.has(traitId)) {
        perTrait[traitId] = entry;
      }
    }
    stats.perTrait = perTrait;
    stats.version = version;
    this.persist(quizId, stats);
    return stats;
  }

  resetQuiz(quizId: string): void {
    storage().removeItem(keyFor(quizId));
  }

  resetAll(): void {
    const store = storage();
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key !== null && key.startsWith(KEY_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      store.removeItem(key);
    }
  }

  private zeroed(quizId: string): QuizStats {
    return {
      quizId,
      version: 0,
      perTrait: {},
      streak: 0,
      roundsPlayed: 0,
    };
  }

  private persist(quizId: string, stats: QuizStats): void {
    storage().setItem(keyFor(quizId), JSON.stringify(stats));
  }
}
