import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral';

const LOOK: Record<BadgeTone, { text: string; glyph: string }> = {
  success: { text: 'text-success', glyph: '✓' },
  danger: { text: 'text-danger', glyph: '✗' },
  warning: { text: 'text-warning', glyph: '!' },
  neutral: { text: 'text-muted', glyph: '' },
};

@Component({
  selector: 'ui-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      @if (look().glyph) {
        <span aria-hidden="true">{{ look().glyph }}</span>
      }
      {{ label() }}
    </span>
  `,
})
export class StatusBadge {
  readonly tone = input.required<BadgeTone>();
  readonly label = input.required<string>();

  protected readonly look = computed(() => LOOK[this.tone()]);
  protected readonly classes = computed(() => `inline-flex items-center gap-1 text-sm font-medium ${this.look().text}`);
}
