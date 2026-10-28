import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from '../../shared/ui/card.directive';
import { ScoreSide } from './score-side';

@Component({
  selector: 'app-confidence-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <section uiCard>
      <h3 class="type-card">Confidence vs. accuracy</h3>
      <p class="type-body font-semibold">{{ side().label }}</p>
      <p class="type-detail">
        Average confidence {{ round(side().meanConfidence) }}% · {{ round(side().percentCorrect) }}%
        correct
      </p>
      @if (before(); as b) {
        <p class="type-detail">Before this round: {{ b.label }}</p>
      }
    </section>
  `,
})
export class ConfidenceCard {
  side = input.required<ScoreSide>();
  before = input<ScoreSide | null>(null);

  round(v: number): number {
    return Math.round(v);
  }
}
