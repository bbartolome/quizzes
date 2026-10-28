import { Component, output } from '@angular/core';
import { Button } from '../../shared/ui/button.directive';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'app-bank-unavailable',
  standalone: true,
  imports: [Button, EmptyState],
  template: `
    <ui-empty-state message="Couldn't load this quiz. Check your connection and try again.">
      <button uiButton variant="secondary" type="button" (click)="retry.emit()">Retry</button>
    </ui-empty-state>
  `,
})
export class BankUnavailable {
  readonly retry = output<void>();
}
