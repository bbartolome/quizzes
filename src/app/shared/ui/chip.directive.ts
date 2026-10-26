import { Directive, computed, input } from '@angular/core';

export type ChipState = 'idle' | 'selected';

const SHAPE =
  'border rounded-full px-3 py-1.5 text-sm font-medium text-text cursor-pointer select-none transition';
const FOCUS = 'focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface';

const LOOK: Record<ChipState, string> = {
  idle: 'border-default bg-raised hover:bg-sunken',
  selected: 'border-accent bg-accent-subtle',
};

@Directive({
  selector: 'button[uiChip], label[uiChip]',
  host: { '[class]': 'classes()' },
})
export class Chip {
  readonly state = input<ChipState>('idle');

  protected readonly classes = computed(() => `${SHAPE} ${FOCUS} ${LOOK[this.state()]}`);
}
