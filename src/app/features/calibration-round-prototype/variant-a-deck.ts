// PROTOTYPE variant A: one item at a time, two steps (pick a choice, then a confidence), explicit Next.
import { Component, computed, model, output, signal } from '@angular/core';
import { CONFIDENCE_LEVELS, PROTO_ITEMS, ProtoAnswer, isComplete } from './prototype-items';

@Component({
  selector: 'app-variant-a-deck',
  template: `
    <div class="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col p-4 sm:p-6">
      <div class="mb-8 space-y-2">
        <div class="flex justify-between text-sm text-slate-500">
          <span>Item {{ index() + 1 }} of {{ items.length }}</span>
          <span>No feedback until the end</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-200">
          <div class="h-full bg-indigo-600 transition-all" [style.width.%]="(index() / items.length) * 100"></div>
        </div>
      </div>

      <h2 class="mb-6 text-2xl font-semibold text-slate-900">{{ item().prompt }}</h2>

      <div class="grid grid-cols-2 gap-3">
        @for (c of item().choices; track c; let ci = $index) {
          <button
            type="button"
            class="rounded-xl border-2 p-6 text-lg font-medium transition"
            [class]="current().choice === ci ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'"
            (click)="set({ choice: $any(ci) })"
          >
            {{ c }}
          </button>
        }
      </div>

      @if (current().choice !== null) {
        <div class="mt-8 space-y-3">
          <p class="text-sm font-medium text-slate-700">
            How sure are you that it's <strong>{{ item().choices[current().choice!] }}</strong>?
          </p>
          <div class="grid grid-cols-6 gap-2">
            @for (lvl of levels; track lvl) {
              <button
                type="button"
                class="rounded-lg border py-3 text-sm font-semibold"
                [class]="current().confidence === lvl ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'"
                (click)="set({ confidence: lvl })"
              >
                {{ lvl }}%
              </button>
            }
          </div>
          <div class="flex justify-between text-xs text-slate-400">
            <span>coin flip</span><span>certain</span>
          </div>
        </div>
      }

      <div class="mt-auto flex justify-between pt-10">
        <button type="button" class="text-sm text-slate-500 disabled:opacity-30" [disabled]="index() === 0" (click)="index.set(index() - 1)">
          ← Back
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white disabled:bg-slate-300"
          [disabled]="!isComplete(current())"
          (click)="next()"
        >
          {{ isLast() ? 'Finish round' : 'Next →' }}
        </button>
      </div>
    </div>
  `,
})
export class VariantADeck {
  readonly answers = model.required<ProtoAnswer[]>();
  readonly finished = output<void>();

  readonly items = PROTO_ITEMS;
  readonly levels = CONFIDENCE_LEVELS;
  readonly isComplete = isComplete;
  readonly index = signal(0);
  readonly item = computed(() => this.items[this.index()]);
  readonly current = computed(() => this.answers()[this.index()]);
  readonly isLast = computed(() => this.index() === this.items.length - 1);

  set(patch: Partial<ProtoAnswer>): void {
    const i = this.index();
    this.answers.update((all) => all.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  next(): void {
    if (this.isLast()) this.finished.emit();
    else this.index.set(this.index() + 1);
  }
}
