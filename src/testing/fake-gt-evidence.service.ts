import { signal, Signal } from '@angular/core';
import { GtFacet } from '../app/features/game-theory/state/gt-evidence.service';

export interface RecordedAttempt {
  conceptIds: string[];
  correct: boolean;
  facet: GtFacet;
}

/**
 * In-memory GtEvidenceService for page specs. Records calls and writes nothing.
 * It mirrors the public surface of the real service.
 */
export class FakeGtEvidenceService {
  readonly records: RecordedAttempt[] = [];
  readonly dailyCalls: Date[] = [];
  sessionEnds = 0;
  readonly migrations: { version: number; conceptIds: string[] }[] = [];
  private readonly failed = signal(false);
  readonly saveFailed: Signal<boolean> = this.failed.asReadonly();

  /** Sets the flag that saveFailed reports, for a spec of the write-failure message. */
  setSaveFailed(value: boolean): void {
    this.failed.set(value);
  }

  record(conceptIds: string[], correct: boolean, facet: GtFacet, _now: Date): void {
    this.records.push({ conceptIds: [...conceptIds], correct, facet });
  }

  recordDaily(now: Date): void {
    this.dailyCalls.push(now);
  }

  recordSessionEnd(): void {
    this.sessionEnds += 1;
  }

  migrateContent(version: number, conceptIds: string[]): void {
    this.migrations.push({ version, conceptIds: [...conceptIds] });
  }
}
