import { Component, input, output } from '@angular/core';

interface Stop {
  side: 0 | 1;
  confidence: number;
}

const STOP_CONFIDENCES: readonly number[] = [100, 90, 80, 70, 60];

@Component({
  selector: 'app-bipolar-scale',
  standalone: true,
  template: `
    <div class="w-full">
      <div class="mb-1 flex items-center justify-between text-xs font-medium text-gray-500">
        <span>{{ options()[0] }}</span>
        <span>{{ options()[1] }}</span>
      </div>
      <div class="grid grid-cols-11 gap-0.5">
        @for (stop of stops; track stop) {
          <button
            type="button"
            [attr.aria-label]="label(stop)"
            [attr.aria-pressed]="isPressed(stop) ? 'true' : 'false'"
            [class.border-blue-600]="isPressed(stop)"
            [class.bg-blue-600]="isPressed(stop)"
            [class.text-white]="isPressed(stop)"
            [class.hover:bg-blue-50]="!isPressed(stop)"
            class="rounded border border-gray-300 bg-white px-0.5 py-1.5 text-[10px] font-medium leading-none text-gray-900 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            (click)="answer.emit({ side: stop.side, confidence: stop.confidence })"
          >
            {{ stop.confidence }}
          </button>
        }
      </div>
    </div>
  `,
})
export class BipolarScale {
  readonly options = input.required<[string, string]>();
  readonly selected = input<{ side: 0 | 1; confidence: number } | null>(null);
  readonly answer = output<{ side: 0 | 1; confidence: number }>();

  readonly stops: readonly Stop[] = [
    ...STOP_CONFIDENCES.map((confidence): Stop => ({ side: 0, confidence })),
    { side: 0, confidence: 50 },
    ...[60, 70, 80, 90, 100].map((confidence): Stop => ({ side: 1, confidence })),
  ];

  label(stop: Stop): string {
    return stop.confidence === 50
      ? '50% no idea'
      : `${this.options()[stop.side]} ${stop.confidence}%`;
  }

  isPressed(stop: Stop): boolean {
    const selected = this.selected();
    if (!selected) return false;
    if (stop.confidence === 50) return selected.confidence === 50;
    return selected.side === stop.side && selected.confidence === stop.confidence;
  }
}
