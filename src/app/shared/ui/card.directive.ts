import { Directive, booleanAttribute, computed, input } from '@angular/core';

export type CardTone = 'raised' | 'sunken';

const CLASSES: Record<CardTone, string> = {
  raised: 'bg-raised border border-default rounded-lg p-5 shadow-sm',
  sunken: 'bg-sunken rounded-lg p-4',
};

// §7.3 selected look: accent border and subtle background, keeping the tone's shape.
const SELECTED: Record<CardTone, string> = {
  raised: 'border border-accent bg-accent-subtle rounded-lg p-5 shadow-sm',
  sunken: 'border border-accent bg-accent-subtle rounded-lg p-4',
};

const FOCUS = 'focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface';

@Directive({
  selector: '[uiCard]',
  host: { '[class]': 'classes()' },
})
export class Card {
  readonly tone = input<CardTone>('raised');
  readonly interactive = input(false, { transform: booleanAttribute });
  readonly selected = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const look = this.selected() ? SELECTED[this.tone()] : CLASSES[this.tone()];
    return this.interactive() ? `${look} hover:shadow-md ${FOCUS}` : look;
  });
}
