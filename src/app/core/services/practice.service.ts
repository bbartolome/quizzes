import { Injectable, Signal, signal } from '@angular/core';
import { AttemptInput, PracticeSnapshot } from '../models/practice.models';
import { DateKey } from '../utils/dates';

function zeroedSnapshot(): PracticeSnapshot {
  return {
    enabled: true,
    streak: 0,
    longest: 0,
    restDays: 0,
    practicedToday: false,
    attemptsToday: 0,
  };
}

/** Inert until P2 fills in the bodies. The public surface is final: P2 keeps these signatures. */
@Injectable({ providedIn: 'root' })
export class PracticeService {
  readonly saveFailed: Signal<boolean> = signal(false).asReadonly();

  recordAttempt(quizId: string, input: AttemptInput, now?: Date): PracticeSnapshot {
    return zeroedSnapshot();
  }

  recordDaily(now?: Date): PracticeSnapshot {
    return zeroedSnapshot();
  }

  snapshot(now?: Date): PracticeSnapshot {
    return zeroedSnapshot();
  }

  setEnabled(enabled: boolean): void {}

  lastPlayed(): Readonly<Record<string, string>> {
    return {};
  }

  conceptDays(): Readonly<Record<string, { days: number; lastDay: DateKey }>> {
    return {};
  }

  badges(): Readonly<Record<string, { earnedAt: string; evidence: string }>> {
    return {};
  }

  recordBadges(earned: { id: string; evidence: string }[], now?: Date): void {}
}
