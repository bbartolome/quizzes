import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { PracticeService } from '../../core/services/practice.service';
import { NAMES_THE_TRAP, NOTICES_LOOKALIKES, SURE_MEANS_SURE } from '../../core/utils/badges';
import { BadgeEvaluation, BadgeEvaluator } from './badge-evaluator';

/** Which results screen the line sits on: Confidence, or the Traps and Biases/Fallacies reports. */
export type BadgeSurface = 'confidence' | 'practice';

/** The line shown for knows-what-it-knows, in place of its insight. */
export const KNOWS_LINE =
  'You showed that your confident answers are right more often than your guesses';

/**
 * The one quiet line for a results screen, or null. Pure.
 * - Confidence: knows-what-it-knows (fixed sentence), else sure-means-sure, when earned at all.
 * - Practice: notices-lookalikes, else names-the-trap, but only when earned by this evaluation.
 */
export function resultsLine(
  surface: BadgeSurface,
  earned: ReadonlySet<string>,
  newly: ReadonlySet<string>,
): string | null {
  if (surface === 'confidence') {
    if (earned.has('knows-what-it-knows')) return KNOWS_LINE;
    if (earned.has(SURE_MEANS_SURE.id)) return SURE_MEANS_SURE.insight;
    return null;
  }
  for (const def of [NOTICES_LOOKALIKES, NAMES_THE_TRAP]) {
    if (newly.has(def.id)) return def.insight;
  }
  return null;
}

/**
 * Evaluates the badges on a results screen and shows the one quiet line. The line is hidden
 * when the practice layer is off; evaluation still runs so stored badges stay accurate.
 * Placed on the results screens only, never on the answer path.
 */
@Component({
  selector: 'app-badge-line',
  template: `
    @if (enabled() && line(); as text) {
      <p class="type-detail" data-testid="badge-line">{{ text }}</p>
    }
  `,
})
export class BadgeLine implements OnInit {
  readonly surface = input<BadgeSurface>('practice');

  private readonly evaluator = inject(BadgeEvaluator);
  private readonly practice = inject(PracticeService);

  protected readonly enabled = signal(this.practice.snapshot().enabled);
  private readonly result = signal<BadgeEvaluation | null>(null);

  protected readonly line = computed(() => {
    const result = this.result();
    if (result === null) return null;
    return resultsLine(this.surface(), new Set(result.earned), new Set(result.newlyEarned));
  });

  ngOnInit(): void {
    this.evaluator.evaluate().subscribe((evaluation) => this.result.set(evaluation));
  }
}
