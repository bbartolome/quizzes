import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from './card.directive';

@Component({
  selector: 'ui-empty-state',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section uiCard tone="sunken">
      <h2 class="type-section">{{ heading() }}</h2>
      <p class="type-detail">{{ message() }}</p>
      <ng-content />
    </section>
  `,
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
}
