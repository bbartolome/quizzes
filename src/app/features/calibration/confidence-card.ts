import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ScoreSide } from './score-side';

@Component({
  selector: 'app-confidence-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3>Confidence vs. accuracy</h3>
    <p class="text-lg font-semibold">{{ side().label }}</p>
    <p>Average confidence {{ round(side().meanConfidence) }}% · {{ round(side().percentCorrect) }}% correct</p>
    @if (before(); as b) {
      <p class="text-sm">Before this round: {{ b.label }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      background: white;
      border-radius: 0.75rem;
      padding: 1rem;
    }
  `,
})
export class ConfidenceCard {
  side = input.required<ScoreSide>();
  before = input<ScoreSide | null>(null);

  round(v: number): number {
    return Math.round(v);
  }
}
