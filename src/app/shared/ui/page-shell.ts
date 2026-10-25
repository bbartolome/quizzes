import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from './button.directive';

export interface PageBack {
  label: string;
  link: string;
}

const WIDTH = {
  narrow: 'max-w-2xl',
  wide: 'max-w-5xl',
} as const;

@Component({
  selector: 'ui-page-shell',
  imports: [Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col bg-surface">
      <div [class]="column()">
        @if (back(); as b) {
          <a uiButton variant="link" [routerLink]="b.link">{{ b.label }}</a>
        }
        @if (eyebrow()) {
          <p class="type-eyebrow">{{ eyebrow() }}</p>
        }
        <h1 class="type-title">{{ title() }}</h1>
        @if (description()) {
          <p class="type-detail">{{ description() }}</p>
        }
        <ng-content />
        <ng-content select="[footer]" />
      </div>
    </div>
  `,
})
export class PageShell {
  readonly title = input('');
  readonly eyebrow = input<string>();
  readonly description = input<string>();
  readonly width = input.required<keyof typeof WIDTH>();
  readonly back = input<PageBack>();

  protected readonly column = computed(
    () => `mx-auto flex w-full flex-1 flex-col px-4 py-8 sm:px-8 ${WIDTH[this.width()]}`,
  );
}
