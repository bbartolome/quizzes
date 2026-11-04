import { signal, Signal } from '@angular/core';
import type {
  ConceptLearn,
  LearnState,
  TutorialStage,
} from '../app/features/game-theory/lib/state.types';
import type { DateKey } from '../app/core/utils/dates';
import type { MasteryState } from '../app/core/models/practice.models';

type DailyEntry = LearnState['daily'][string];

export interface RefreshCall {
  conceptIds?: readonly string[];
  requiresChallenge?: Record<string, boolean>;
}

/**
 * In-memory GtLearnService for page specs. It mirrors the public surface of the real service and
 * writes nothing to storage. `introduced` is kept in step with the stages, as the real service
 * derives it: a concept is introduced at stage 2 or above, or once tested out.
 * `seedIntroduced` sets concepts straight to Try, which is what a page spec needs to start from.
 * Each refresh call is recorded, so a spec can check the requiresChallenge map a page passes.
 */
export class FakeGtLearnService {
  readonly introduced = new Set<string>();
  readonly refreshCalls: RefreshCall[] = [];
  private readonly concepts: Record<string, ConceptLearn> = {};
  private readonly daily: Record<string, DailyEntry> = {};
  private readonly failed = signal(false);
  private readonly masteries: Record<string, MasteryState> = {};
  readonly saveFailed: Signal<boolean> = this.failed.asReadonly();

  /** Sets the mastery state masteryByConcept reports for a concept. Unset concepts are New. */
  setMastery(conceptId: string, state: MasteryState): void {
    this.masteries[conceptId] = state;
  }

  masteryByConcept(conceptIds: readonly string[]): Record<string, MasteryState> {
    return Object.fromEntries(conceptIds.map((id) => [id, this.masteries[id] ?? 'new']));
  }

  seedIntroduced(conceptIds: readonly string[]): void {
    for (const id of conceptIds) {
      this.concepts[id] = { stage: 2, testedOut: false };
      this.introduced.add(id);
    }
  }

  read(): LearnState {
    return {
      version: 1,
      concepts: { ...this.concepts },
      summary: { mastered: 0, introduced: this.introduced.size, total: 0 },
      daily: { ...this.daily },
    };
  }

  setStage(conceptId: string, stage: TutorialStage): boolean {
    const current = this.concepts[conceptId];
    const from = current?.stage ?? 0;
    this.concepts[conceptId] = {
      stage: stage > from ? stage : from,
      testedOut: current?.testedOut ?? false,
    };
    this.syncIntroduced(conceptId);
    return true;
  }

  testOut(conceptId: string): boolean {
    this.concepts[conceptId] = { stage: 3, testedOut: true };
    this.syncIntroduced(conceptId);
    return true;
  }

  recordDailyAnswer(dateKey: DateKey, entry: DailyEntry): boolean {
    this.daily[dateKey] = { ...entry };
    return true;
  }

  refresh(conceptIds?: readonly string[], requiresChallenge?: Record<string, boolean>): boolean {
    this.refreshCalls.push({
      conceptIds: conceptIds ? [...conceptIds] : undefined,
      requiresChallenge: requiresChallenge ? { ...requiresChallenge } : undefined,
    });
    return true;
  }

  /** Sets the flag that saveFailed reports, for a spec of the write-failure message. */
  setSaveFailed(value: boolean): void {
    this.failed.set(value);
  }

  private syncIntroduced(conceptId: string): void {
    const entry = this.concepts[conceptId];
    if (entry.stage >= 2 || entry.testedOut) {
      this.introduced.add(conceptId);
    } else {
      this.introduced.delete(conceptId);
    }
  }
}
