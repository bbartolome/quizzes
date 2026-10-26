import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-2 w-full overflow-hidden rounded-full bg-sunken">
      <div class="h-full rounded-full bg-accent" [style.width.%]="value()"></div>
    </div>
  `,
})
export class ProgressBar {
  readonly value = input.required<number>();
}
