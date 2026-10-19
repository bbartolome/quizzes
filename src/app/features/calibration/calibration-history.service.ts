import { Injectable } from '@angular/core';
import type {
  CalibrationAnswer,
  CalibrationBank,
  CalibrationHistory,
  CalibrationRound,
  CalibrationSummary,
  PendingRound,
} from './calibration.models';
import { answerBrier, isCorrect } from './scoring';

const KEY_PREFIX = 'stats:calibration:';

function storage(): Storage {
  return globalThis.localStorage;
}

function keyFor(quizId: string): string {
  return `${KEY_PREFIX}${quizId}`;
}

@Injectable({ providedIn: 'root' })
export class CalibrationHistoryService {
  getHistory(quizId: string): CalibrationHistory {
    const raw = storage().getItem(keyFor(quizId));
    if (raw === null) {
      return this.zeroed(quizId);
    }
    try {
      const parsed = JSON.parse(raw) as Partial<CalibrationHistory> | null;
      if (!parsed || typeof parsed !== 'object') {
        return this.zeroed(quizId);
      }
      const summary: Partial<CalibrationSummary> =
        parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : {};
      return {
        quizId,
        bankVersion: typeof parsed.bankVersion === 'number' ? parsed.bankVersion : 0,
        log: Array.isArray(parsed.log) ? parsed.log : [],
        summary: {
          roundsPlayed: typeof summary.roundsPlayed === 'number' ? summary.roundsPlayed : 0,
          brierSum: typeof summary.brierSum === 'number' ? summary.brierSum : 0,
          answerCount: typeof summary.answerCount === 'number' ? summary.answerCount : 0,
        },
        pending: parsed.pending && typeof parsed.pending === 'object' ? parsed.pending : null,
      };
    } catch {
      return this.zeroed(quizId);
    }
  }

  getSummary(quizId: string): CalibrationHistory['summary'] {
    return this.getHistory(quizId).summary;
  }

  getPending(quizId: string): PendingRound | null {
    return this.getHistory(quizId).pending;
  }

  savePending(quizId: string, pending: PendingRound): CalibrationHistory {
    const history = this.getHistory(quizId);
    history.pending = pending;
    this.persist(quizId, history);
    return history;
  }

  discardPending(quizId: string): void {
    const history = this.getHistory(quizId);
    history.pending = null;
    this.persist(quizId, history);
  }

  submit(
    quizId: string,
    bank: CalibrationBank,
    pending: PendingRound,
    now: Date = new Date(),
  ): CalibrationRound {
    const byId = new Map(bank.items.map((item) => [item.id, item]));

    const answers: CalibrationAnswer[] = [];
    for (const drawn of pending.items) {
      const entry = pending.picks[drawn.itemId];
      const pick = entry?.pick;
      const confidence = entry?.confidence;
      if (pick === undefined || confidence === undefined) {
        throw new Error(`Pending pick is incomplete for item ${drawn.itemId}`);
      }
      const item = byId.get(drawn.itemId);
      if (item === undefined) {
        throw new Error(`Item ${drawn.itemId} was not found in the bank`);
      }
      answers.push({
        itemId: drawn.itemId,
        pick,
        confidence,
        correct: isCorrect(item, pick),
      });
    }

    const brier = answers.reduce((sum, a) => sum + answerBrier(a.confidence, a.correct), 0);
    const round: CalibrationRound = {
      submittedAt: now.toISOString(),
      bankVersion: pending.bankVersion,
      answers,
    };

    const history = this.getHistory(quizId);
    history.bankVersion = bank.version;
    history.log = [...history.log, round];
    history.summary = {
      roundsPlayed: history.summary.roundsPlayed + 1,
      brierSum: history.summary.brierSum + brier,
      answerCount: history.summary.answerCount + answers.length,
    };
    history.pending = null;
    this.persist(quizId, history);
    return round;
  }

  lastRound(quizId: string): CalibrationRound | null {
    const log = this.getHistory(quizId).log;
    return log.length > 0 ? log[log.length - 1] : null;
  }

  allAnswers(quizId: string): CalibrationAnswer[] {
    return this.getHistory(quizId).log.flatMap((round) => round.answers);
  }

  /** Answers from every round except the most recent one, in order. */
  lifetimeBefore(quizId: string): CalibrationAnswer[] {
    const log = this.getHistory(quizId).log;
    return log.slice(0, -1).flatMap((round) => round.answers);
  }

  private zeroed(quizId: string): CalibrationHistory {
    return {
      quizId,
      bankVersion: 0,
      log: [],
      summary: { roundsPlayed: 0, brierSum: 0, answerCount: 0 },
      pending: null,
    };
  }

  private persist(quizId: string, history: CalibrationHistory): void {
    storage().setItem(keyFor(quizId), JSON.stringify(history));
  }
}
