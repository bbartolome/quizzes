import { Component, effect, input, output, signal } from '@angular/core';
import type { FourWayChoice } from './calibration.models';
import { SELECTED_LOOK } from '../../shared/ui/option-row';

@Component({
  selector: 'app-four-way-control',
  template: `
    <div class="flex flex-wrap gap-2">
      @for (c of choices; track c.id) {
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface"
          [class]="choice() === c.id ? pressedLook : idleLook"
          [attr.aria-pressed]="choice() === c.id"
          (click)="pick(c.id)"
        >
          {{ c.label }}
        </button>
      }
    </div>
    @if (choice()) {
      <div class="mt-3 flex flex-wrap gap-2" aria-label="Confidence">
        @for (v of stops; track v) {
          <button
            type="button"
            class="rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface"
            [class]="v === confidence() ? pressedLook : idleLook"
            [attr.aria-pressed]="v === confidence()"
            (click)="rate(v)"
          >
            {{ v }}%
          </button>
        }
      </div>
    }
  `,
})
export class FourWayControl {
  options = input.required<[string, string]>();
  selected = input<{ choice?: FourWayChoice; confidence?: number }>({});
  change = output<{ choice: FourWayChoice; confidence: number | null }>();

  choice = signal<FourWayChoice | null>(null);
  confidence = signal<number | null>(null);
  readonly stops = [0, 25, 50, 75, 100];
  readonly idleLook = 'border-default bg-raised text-text hover:bg-sunken';
  readonly pressedLook = `${SELECTED_LOOK} text-text`;

  protected get choices(): Array<{ id: FourWayChoice; label: string }> {
    return [
      { id: 'neither', label: 'Neither' },
      { id: 'a', label: this.options()[0] },
      { id: 'b', label: this.options()[1] },
      { id: 'both', label: 'Both' },
    ];
  }

  constructor() {
    effect(() => {
      const selected = this.selected();
      this.choice.set(selected.choice ?? null);
      this.confidence.set(selected.confidence ?? null);
    });
  }

  protected pick(c: FourWayChoice): void {
    if (c !== this.choice()) {
      this.choice.set(c);
      this.confidence.set(null);
      this.change.emit({ choice: c, confidence: null });
    }
  }

  protected rate(v: number): void {
    this.confidence.set(v);
    this.change.emit({ choice: this.choice()!, confidence: v });
  }
}
