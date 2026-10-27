import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-callout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg bg-accent-subtle p-4 text-sm text-text">
      @if (label()) {
        <span class="font-semibold">{{ label() }}: </span>
      }
      <ng-content />
    </div>
  `,
})
export class Callout {
  readonly label = input<string>();
}
