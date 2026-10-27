import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from './card.directive';

@Component({
  selector: 'ui-empty-state',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section uiCard tone="sunken">
      @if (heading()) {
        <h2 class="type-section">{{ heading() }}</h2>
      }
      <p class="type-detail" [attr.data-testid]="messageTestId()">{{ message() }}</p>
      <ng-content />
    </section>
  `,
})
export class EmptyState {
  readonly heading = input<string>();
  readonly message = input.required<string>();
  /** Testid of the message element. A page with an existing testid keeps it (docs/specs/design-system.md §12). */
  readonly messageTestId = input<string>();
}
