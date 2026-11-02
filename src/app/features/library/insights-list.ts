import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PracticeService } from '../../core/services/practice.service';
import { CROSS_QUIZ_BADGES } from '../../core/utils/badges';
import { Card } from '../../shared/ui/card.directive';
import { BadgeEvaluator } from '../badges/badge-evaluator';

/**
 * The Insights list on the library page: earned badges with their insight, then each unearned
 * criterion. No totals, counts, ranking or animation (practice-layer.md §8, §11).
 * Hidden while the practice layer is turned off.
 */
@Component({
  selector: 'app-insights-list',
  imports: [Card],
  template: `
    @if (enabled()) {
      <section uiCard class="space-y-4" aria-label="Insights" data-testid="insights-list">
        <h2 class="type-section">Insights</h2>

        @for (badge of earned(); track badge.id) {
          <div class="space-y-1" data-testid="insight-earned">
            <p class="type-card">{{ badge.title }}</p>
            <p class="type-body">{{ badge.insight }}</p>
          </div>
        }

        @for (badge of unearned(); track badge.id) {
          <div class="space-y-1" data-testid="insight-unearned">
            <p class="type-eyebrow">Can you show…?</p>
            <p class="type-body">{{ badge.criterion }}</p>
          </div>
        }
      </section>
    }
  `,
})
export class InsightsList implements OnInit {
  private readonly evaluator = inject(BadgeEvaluator);
  private readonly practice = inject(PracticeService);

  /** Read at render time, so the Today panel's "Hide streak and badges" toggle hides this list at once. */
  protected enabled(): boolean {
    return this.practice.snapshot().enabled;
  }

  private readonly earnedIds = signal<ReadonlySet<string>>(
    new Set(Object.keys(this.practice.badges())),
  );

  protected readonly earned = computed(() =>
    CROSS_QUIZ_BADGES.filter((badge) => this.earnedIds().has(badge.id)),
  );

  protected readonly unearned = computed(() =>
    CROSS_QUIZ_BADGES.filter((badge) => !this.earnedIds().has(badge.id)),
  );

  ngOnInit(): void {
    this.evaluator.evaluate().subscribe((evaluation) => this.earnedIds.set(new Set(evaluation.earned)));
  }
}
