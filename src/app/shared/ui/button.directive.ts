import { Directive, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

const SIZE = 'px-5 py-2.5 text-sm font-semibold rounded-lg';
const FOCUS = 'focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface';
const DISABLED = 'disabled:opacity-50 disabled:cursor-not-allowed';

const CLASSES: Record<ButtonVariant, string> = {
  primary: `${SIZE} bg-accent text-on-accent hover:bg-accent-hover ${FOCUS} ${DISABLED}`,
  secondary: `${SIZE} border border-strong bg-raised text-text hover:bg-sunken ${FOCUS} ${DISABLED}`,
  danger: `${SIZE} bg-danger text-on-accent hover:opacity-90 ${FOCUS} ${DISABLED}`,
  link: `text-sm font-semibold text-accent hover:underline ${FOCUS} ${DISABLED}`,
};

@Directive({
  selector: 'button[uiButton], a[uiButton]',
  host: { '[class]': 'classes()' },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');

  protected readonly classes = computed(() => CLASSES[this.variant()]);
}
