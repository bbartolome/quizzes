import { Directive, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

const SIZE = 'px-5 py-2.5 text-sm font-semibold rounded-lg';
const FOCUS = 'focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface';
const DISABLED = 'disabled:opacity-50 disabled:cursor-not-allowed';

// A pressed style applies only under aria-pressed="true", so buttons without aria-pressed are unchanged.
// Pressed uses the selected look from spec §12 (accent border, accent-subtle fill) where the variant has a
// border, and the same inversion on the filled variants, so a chosen option reads apart from the rest.
const CLASSES: Record<ButtonVariant, string> = {
  primary: `${SIZE} bg-accent text-on-accent hover:bg-accent-hover aria-pressed:bg-accent-subtle aria-pressed:text-accent ${FOCUS} ${DISABLED}`,
  secondary: `${SIZE} border border-strong bg-raised text-text hover:bg-sunken aria-pressed:border-accent aria-pressed:bg-accent-subtle ${FOCUS} ${DISABLED}`,
  danger: `${SIZE} bg-danger text-on-accent hover:opacity-90 aria-pressed:bg-danger-subtle aria-pressed:text-danger ${FOCUS} ${DISABLED}`,
  link: `text-sm font-semibold text-accent hover:underline aria-pressed:underline ${FOCUS} ${DISABLED}`,
};

@Directive({
  selector: 'button[uiButton], a[uiButton]',
  host: { '[class]': 'classes()' },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');

  protected readonly classes = computed(() => CLASSES[this.variant()]);
}
