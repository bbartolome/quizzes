import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Verdict = 'correct' | 'incorrect';

const LOOK: Record<Verdict, { text: string; glyph: string; word: string }> = {
  correct: { text: 'text-success', glyph: '✓', word: 'Correct' },
  incorrect: { text: 'text-danger', glyph: '✗', word: 'Incorrect' },
};

@Component({
  selector: 'ui-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2 rounded-lg bg-sunken p-4 text-sm text-text">
      <p class="font-semibold" [class]="look().text">
        <span aria-hidden="true">{{ look().glyph }}</span>
        {{ look().word }}
      </p>
      <ng-content />
    </div>
  `,
})
export class FeedbackPanel {
  readonly verdict = input.required<Verdict>();

  protected readonly look = computed(() => LOOK[this.verdict()]);
}
