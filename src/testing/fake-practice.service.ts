import { Signal, signal } from '@angular/core';
import { AttemptInput, PracticeSnapshot } from '../app/core/models/practice.models';
import { PracticeService } from '../app/core/services/practice.service';
import { DateKey } from '../app/core/utils/dates';

/** In-memory PracticeService for consumer specs. Records calls; a spec seeds the state it reads. */
export class FakePracticeService implements PracticeService {
  readonly attempts: { quizId: string; input: AttemptInput }[] = [];
  readonly recordedBadges: { id: string; evidence: string }[] = [];
  dailyCount = 0;

  private current: PracticeSnapshot = {
    enabled: true,
    streak: 0,
    longest: 0,
    restDays: 0,
    practicedToday: false,
    attemptsToday: 0,
  };
  private lastPlayedAt: Record<string, string> = {};
  private days: Record<string, { days: number; lastDay: DateKey }> = {};
  private earned: Record<string, { earnedAt: string; evidence: string }> = {};
  private readonly failed = signal(false);
  readonly saveFailed: Signal<boolean> = this.failed.asReadonly();

  seed(state: {
    snapshot?: PracticeSnapshot;
    lastPlayed?: Record<string, string>;
    conceptDays?: Record<string, { days: number; lastDay: DateKey }>;
    badges?: Record<string, { earnedAt: string; evidence: string }>;
  }): void {
    if (state.snapshot) this.current = state.snapshot;
    if (state.lastPlayed) this.lastPlayedAt = state.lastPlayed;
    if (state.conceptDays) this.days = state.conceptDays;
    if (state.badges) this.earned = state.badges;
  }

  setSaveFailed(value: boolean): void {
    this.failed.set(value);
  }

  recordAttempt(quizId: string, input: AttemptInput): PracticeSnapshot {
    this.attempts.push({ quizId, input });
    return this.current;
  }

  recordDaily(): PracticeSnapshot {
    this.dailyCount++;
    return this.current;
  }

  snapshot(): PracticeSnapshot {
    return this.current;
  }

  setEnabled(enabled: boolean): void {
    this.current = { ...this.current, enabled };
  }

  lastPlayed(): Readonly<Record<string, string>> {
    return this.lastPlayedAt;
  }

  conceptDays(): Readonly<Record<string, { days: number; lastDay: DateKey }>> {
    return this.days;
  }

  badges(): Readonly<Record<string, { earnedAt: string; evidence: string }>> {
    return this.earned;
  }

  recordBadges(earned: { id: string; evidence: string }[]): void {
    this.recordedBadges.push(...earned);
  }
}
