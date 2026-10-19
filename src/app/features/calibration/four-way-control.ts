import { Component, effect, input, output, signal } from '@angular/core';
import type { FourWayChoice } from './calibration.models';

@Component({
  selector: 'app-four-way-control',
  template: `
    <div class="flex flex-wrap gap-2">
      @for (c of choices; track c.id) {
        <button
          type="button"
          [class]="choice() === c.id
            ? 'rounded-lg bg-indigo-600 text-white border-indigo-600'
            : 'rounded-lg bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
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
            [class]="v === confidence()
              ? 'rounded-lg bg-indigo-600 text-white border-indigo-600'
              : 'rounded-lg bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
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
