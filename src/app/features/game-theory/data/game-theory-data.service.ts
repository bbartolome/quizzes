import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, throwError } from 'rxjs';
import { GameTheoryContent } from '../../../core/models/quiz.models';
import type { ReasonCheck } from '../lib/puzzle.types';
import type { TutorialScript } from '../lib/tutorial.types';

// The game-theory content folder, relative to the app root (the manifest dataPath).
const BASE = 'data/quizzes/game-theory/';

export interface GameTheoryTutorialFile {
  version: number;
  tutorials: TutorialScript[];
}

export interface GameTheoryCheckFile {
  version: number;
  checks: ReasonCheck[];
}

export interface GameTheoryData {
  concepts: GameTheoryContent;
  tutorials: GameTheoryTutorialFile;
  checks: GameTheoryCheckFile;
}

/**
 * Loads the three game-theory content files together. One Retry state covers all three:
 * `loadFailed` is set when any of them fails, and `retry()` loads all three again.
 * G8, G15 and G17 each fill their own file and leave this service alone.
 */
@Injectable({ providedIn: 'root' })
export class GameTheoryDataService {
  private readonly http: HttpClient = inject(HttpClient);

  readonly loadFailed = signal(false);

  load(): Observable<GameTheoryData> {
    this.loadFailed.set(false);
    return forkJoin({
      concepts: this.http.get<GameTheoryContent>(`${BASE}concepts.json`),
      tutorials: this.http.get<GameTheoryTutorialFile>(`${BASE}tutorials.json`),
      checks: this.http.get<GameTheoryCheckFile>(`${BASE}checks.json`),
    }).pipe(
      catchError((error: unknown) => {
        this.loadFailed.set(true);
        return throwError(() => error);
      }),
    );
  }

  retry(): Observable<GameTheoryData> {
    return this.load();
  }
}
