import { Injectable } from '@angular/core';

/** Which stats key a scored attempt is written to: card checks or challenges (§10). */
export type GtFacet = 'cards' | 'challenges';

/**
 * Single write path for scored attempts (§9.1). Inert in T2: every method is a no-op.
 * G9 replaces the bodies and keeps these signatures.
 */
@Injectable({ providedIn: 'root' })
export class GtEvidenceService {
  /** A scored attempt. Credits each concept id; a two-concept puzzle passes both. */
  record(conceptIds: string[], correct: boolean, facet: GtFacet, now: Date): void {}

  /** A daily puzzle answer. Also makes the day a practice day (§9.1). */
  recordDaily(now: Date): void {}

  /** End of a card session, if at least one card was checked (§10). */
  recordSessionEnd(): void {}

  /** Runs on every hub load: migrates both stats keys and prunes removed concept ids (§10). */
  migrateContent(version: number, conceptIds: string[]): void {}
}
