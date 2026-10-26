import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ui-progress-dots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (i of indices(); track i) {
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-full focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface"
        [attr.aria-label]="'Item ' + (i + 1)"
        [attr.aria-current]="i === current() ? 'true' : null"
        (click)="select.emit(i)"
      >
        <span class="h-2.5 w-2.5 rounded-full" [class]="fillClass(i)"></span>
      </button>
    }
  `,
})
export class ProgressDots {
  readonly count = input.required<number>();
  readonly current = input.required<number>();
  readonly answered = input.required<boolean[]>();
  readonly select = output<number>();

  protected readonly indices = computed(() => Array.from({ length: this.count() }, (_, i) => i));

  protected fillClass(i: number): string {
    if (i === this.current()) {
      return 'bg-accent';
    }
    if (this.answered()[i]) {
      return 'bg-muted';
    }
    return 'border border-strong';
  }
}
