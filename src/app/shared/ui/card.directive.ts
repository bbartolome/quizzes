import { Directive, booleanAttribute, computed, input } from '@angular/core';

export type CardTone = 'raised' | 'sunken';

const CLASSES: Record<CardTone, string> = {
  raised: 'bg-raised border-default rounded-lg p-5 shadow-sm',
  sunken: 'bg-sunken rounded-lg p-4',
};

@Directive({
  selector: '[uiCard]',
  host: { '[class]': 'classes()' },
})
export class Card {
  readonly tone = input<CardTone>('raised');
  readonly interactive = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    this.interactive() ? `${CLASSES[this.tone()]} hover:shadow-md` : CLASSES[this.tone()],
  );
}
