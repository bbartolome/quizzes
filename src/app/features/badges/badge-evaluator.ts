// Red-commit stub for P7b. The implementation commit replaces this body.
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface BadgeEvaluation {
  /** Every badge id stored after this evaluation (earlier ones plus newly earned). */
  earned: string[];
  /** Ids recorded by this evaluation. */
  newlyEarned: string[];
}

@Injectable({ providedIn: 'root' })
export class BadgeEvaluator {
  evaluate(): Observable<BadgeEvaluation> {
    return of({ earned: [], newlyEarned: [] });
  }
}
