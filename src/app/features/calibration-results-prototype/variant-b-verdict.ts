// PROTOTYPE variant B: a plain-language verdict leads; round and lifetime as two small charts;
// review grouped by what to learn from (confident misses first).
import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CalibrationChart } from './calibration-chart';
import { ResultsView, ReviewItem, flagFor, overUnderPhrase } from './prototype-results-data';

@Component({
  selector: 'app-variant-b-verdict',
  imports: [CalibrationChart, DecimalPipe],
  template: `
    @let v = view();
    <div class="mx-auto max-w-3xl space-y-8 p-4 sm:p-6">
      <section class="text-center">
        <p class="text-sm text-slate-500">
          You were right on {{ hits() }} of {{ v.items.length }} and said, on average, {{ v.roundSummary.meanConfidence | number: '1.0-0' }}%.
        </p>
        <h1 class="mt-2 text-3xl font-bold text-slate-900">This round you were {{ phrase(v.roundSummary) }}.</h1>
        @if (!v.firstRound) {
          <p class="mt-2 text-slate-600">Over your {{ v.lifetimeSummary.n }} earlier answers: {{ phrase(v.lifetimeSummary) }}.</p>
        }
        <div class="mt-4 inline-flex items-baseline gap-2 rounded-full bg-slate-100 px-4 py-1 text-sm text-slate-600">
          Score <strong class="text-slate-900">{{ v.roundSummary.brier | number: '1.2-2' }}</strong>
          <span class="text-xs">(0 = perfect, {{ v.scale.chanceBrier | number: '1.2-2' }} = pure guessing, lower is better)</span>
        </div>
      </section>

      <section class="grid gap-4 sm:grid-cols-2">
        <figure class="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <figcaption class="mb-1 text-sm font-medium text-slate-700">This round</figcaption>
          <app-calibration-chart [scale]="v.scale" [round]="v.round" [roundBars]="true" />
          <p class="text-xs text-slate-400">20 answers: wide bars, read loosely.</p>
        </figure>
        <figure class="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <figcaption class="mb-1 text-sm font-medium text-slate-700">Before this round</figcaption>
          @if (v.firstRound) {
            <div class="flex aspect-[36/29] items-center justify-center rounded-md border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Nothing yet. Your lifetime curve starts with your next round.
            </div>
          } @else {
            <app-calibration-chart [scale]="v.scale" [lifetime]="v.lifetime" />
            <p class="text-xs text-slate-400">{{ v.lifetimeSummary.n }} answers: this is the one to trust.</p>
          }
        </figure>
      </section>

      <section class="space-y-6">
        @for (g of groups(); track g.title) {
          @if (g.items.length) {
            <div>
              <h2 class="mb-2 font-semibold" [class]="g.tone">{{ g.title }} <span class="font-normal text-slate-400">({{ g.items.length }})</span></h2>
              <p class="mb-2 text-sm text-slate-500">{{ g.hint }}</p>
              <ul class="space-y-1">
                @for (it of g.items; track it.id) {
                  <li class="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200">
                    <span class="w-10 text-right font-mono text-slate-500">{{ it.confidence }}%</span>
                    <span class="flex-1 text-slate-800">{{ it.prompt }}</span>
                    <span class="text-slate-500">{{ it.pick }}@if (!it.correct) { → <strong class="text-slate-800">{{ it.answer }}</strong> }</span>
                    @if (flag(it); as f) {
                      <span class="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{{ f }}</span>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        }
      </section>
    </div>
  `,
})
export class VariantBVerdict {
  readonly view = input.required<ResultsView>();
  readonly phrase = overUnderPhrase;

  readonly hits = computed(() => this.view().items.filter((i) => i.correct).length);

  /** "Sure" = at or above the top two stops of the scale. */
  readonly groups = computed(() => {
    const v = this.view();
    const sure = v.scale.levels[v.scale.levels.length - 2];
    const its = v.items;
    return [
      { title: 'Confident misses', tone: 'text-rose-700', hint: 'You were sure and wrong: the answers that cost the most.', items: its.filter((i) => !i.correct && i.confidence >= sure) },
      { title: 'Hedged misses', tone: 'text-amber-700', hint: 'Wrong, but you knew you might be.', items: its.filter((i) => !i.correct && i.confidence < sure) },
      { title: 'Underplayed hits', tone: 'text-sky-700', hint: 'Right, but you doubted it.', items: its.filter((i) => i.correct && i.confidence < sure) },
      { title: 'Confident hits', tone: 'text-emerald-700', hint: 'Sure and right.', items: its.filter((i) => i.correct && i.confidence >= sure) },
    ];
  });

  flag(it: ReviewItem) {
    return flagFor(it, this.view().format);
  }
}
