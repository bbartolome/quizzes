// PROTOTYPE variant B: one tap per item on a single bipolar scale (A 100% … 50% … B 100%), auto-advance.
import { Component, computed, model, output, signal } from '@angular/core';
import { PROTO_ITEMS, ProtoAnswer } from './prototype-items';

interface Stop {
  choice: 0 | 1;
  confidence: number;
}

// 50% is a single shared middle stop: at a coin flip the side doesn't matter.
const STOPS: Stop[] = [
  ...[100, 90, 80, 70, 60].map((confidence) => ({ choice: 0 as const, confidence })),
  { choice: 0, confidence: 50 },
  ...[60, 70, 80, 90, 100].map((confidence) => ({ choice: 1 as const, confidence })),
];

@Component({
  selector: 'app-variant-b-bipolar',
  template: `
    <div class="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div class="mb-10 flex justify-center gap-1.5">
        @for (it of items; track it.id; let i = $index) {
          <span
            class="h-2.5 w-2.5 rounded-full"
            [class]="i === index() ? 'bg-indigo-600 ring-2 ring-indigo-200' : answers()[i].confidence !== null ? 'bg-slate-500' : 'bg-slate-200'"
          ></span>
        }
      </div>

      <h2 class="mb-10 text-center text-2xl font-semibold text-slate-900">{{ item().prompt }}</h2>

      <div class="mb-3 flex justify-between text-lg font-semibold">
        <span class="text-sky-700">{{ item().choices[0] }}</span>
        <span class="text-amber-700">{{ item().choices[1] }}</span>
      </div>

      <div class="grid grid-cols-11 gap-1">
        @for (s of stops; track $index; let si = $index) {
          <button
            type="button"
            class="flex h-16 flex-col items-center justify-center rounded-md border text-xs font-semibold transition"
            [class]="stopClass(si)"
            (click)="pick(s)"
          >
            {{ s.confidence }}
          </button>
        }
      </div>
      <div class="mt-2 flex justify-between text-xs text-slate-400">
        <span>← sure it's {{ item().choices[0] }}</span>
        <span>no idea</span>
        <span>sure it's {{ item().choices[1] }} →</span>
      </div>

      <div class="mt-12 flex justify-center">
        <button type="button" class="text-sm text-slate-500 disabled:opacity-30" [disabled]="index() === 0" (click)="index.set(index() - 1)">
          ↶ Undo / previous item
        </button>
      </div>
    </div>
  `,
})
export class VariantBBipolar {
  readonly answers = model.required<ProtoAnswer[]>();
  readonly finished = output<void>();

  readonly items = PROTO_ITEMS;
  readonly stops = STOPS;
  readonly index = signal(0);
  readonly item = computed(() => this.items[this.index()]);

  stopClass(si: number): string {
    const s = STOPS[si];
    const a = this.answers()[this.index()];
    const selected = a.confidence === s.confidence && (s.confidence === 50 || a.choice === s.choice);
    if (selected) return 'border-indigo-700 bg-indigo-600 text-white';
    if (s.confidence === 50) return 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200';
    const strong = s.confidence >= 90;
    const mid = s.confidence >= 70;
    if (s.choice === 0) {
      const bg = strong ? 'bg-sky-200' : mid ? 'bg-sky-100' : 'bg-sky-50';
      return `border-sky-200 ${bg} text-sky-900 hover:border-sky-500`;
    }
    const bg = strong ? 'bg-amber-200' : mid ? 'bg-amber-100' : 'bg-amber-50';
    return `border-amber-200 ${bg} text-amber-900 hover:border-amber-500`;
  }

  pick(s: Stop): void {
    const i = this.index();
    this.answers.update((all) => all.map((a, j) => (j === i ? { choice: s.choice, confidence: s.confidence } : a)));
    setTimeout(() => {
      if (i === this.items.length - 1) this.finished.emit();
      else this.index.set(i + 1);
    }, 250);
  }
}
