// PROTOTYPE variant C: the whole round as one worksheet, answer in any order, revise freely, submit once.
import { Component, computed, model, output, signal } from '@angular/core';
import { CONFIDENCE_LEVELS, PROTO_ITEMS, ProtoAnswer, isComplete } from './prototype-items';

@Component({
  selector: 'app-variant-c-sheet',
  template: `
    <div class="mx-auto w-full max-w-3xl">
      <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <span class="text-sm text-slate-700"><strong>{{ answered() }}</strong> / {{ items.length }} answered</span>
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          (click)="submit()"
        >
          Submit round
        </button>
      </div>

      <ol class="divide-y divide-slate-100 px-4">
        @for (it of items; track it.id; let i = $index) {
          <li class="grid gap-3 py-4 sm:grid-cols-[1fr_auto]" [class.bg-red-50]="tried() && !isComplete(answers()[i])">
            <div>
              <p class="mb-2 text-sm font-medium text-slate-900">{{ i + 1 }}. {{ it.prompt }}</p>
              <div class="inline-flex overflow-hidden rounded-md border border-slate-300">
                @for (c of it.choices; track c; let ci = $index) {
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm"
                    [class]="answers()[i].choice === ci ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'"
                    (click)="set(i, { choice: $any(ci) })"
                  >
                    {{ c }}
                  </button>
                }
              </div>
            </div>
            <div class="flex items-end gap-1">
              @for (lvl of levels; track lvl) {
                <button
                  type="button"
                  class="w-11 rounded border py-1.5 text-xs font-semibold"
                  [class]="answers()[i].confidence === lvl ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                  (click)="set(i, { confidence: lvl })"
                >
                  {{ lvl }}
                </button>
              }
            </div>
          </li>
        }
      </ol>
      @if (tried() && answered() < items.length) {
        <p class="px-4 pb-24 text-sm text-red-700">Answer the highlighted items (choice and confidence) to submit.</p>
      }
    </div>
  `,
})
export class VariantCSheet {
  readonly answers = model.required<ProtoAnswer[]>();
  readonly finished = output<void>();

  readonly items = PROTO_ITEMS;
  readonly levels = CONFIDENCE_LEVELS;
  readonly isComplete = isComplete;
  readonly tried = signal(false);
  readonly answered = computed(() => this.answers().filter(isComplete).length);

  set(i: number, patch: Partial<ProtoAnswer>): void {
    this.answers.update((all) => all.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  submit(): void {
    this.tried.set(true);
    if (this.answered() === this.items.length) this.finished.emit();
  }
}
