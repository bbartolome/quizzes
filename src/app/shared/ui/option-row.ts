import { Directive, computed, input } from '@angular/core';

export type OptionRowState = 'idle' | 'selected' | 'correct' | 'wrong' | 'missed' | 'neutral';

const BASE =
  'flex cursor-pointer items-center gap-3 p-3 border rounded-lg focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-surface';

const LOOK: Record<OptionRowState, string> = {
  idle: 'border-default',
  neutral: 'border-default',
  selected: 'border-accent bg-accent-subtle',
  correct: 'border-success bg-success-subtle',
  wrong: 'border-danger bg-danger-subtle',
  missed: 'border-warning bg-warning-subtle',
};

@Directive({
  selector: 'label[uiOption]',
  host: { '[class]': 'classes()' },
})
export class OptionRow {
  readonly state = input<OptionRowState>('idle');

  protected readonly classes = computed(() => `${BASE} ${LOOK[this.state()]}`);
}
