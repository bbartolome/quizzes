// PROTOTYPE variant A: one big chart, lifetime leads, this round overlaid as ghost markers.
// Brier tile with anchors below; item review last, collapsed.
import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CalibrationChart } from './calibration-chart';
import { ResultsView, flagFor, overUnderPhrase } from './prototype-results-data';

@Component({
  selector: 'app-variant-a-lifetime-hero',
  imports: [CalibrationChart, DecimalPipe],
  template: `
    @let v = view();
    <div class="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-400">Round submitted · {{ v.items.length }} items</p>
        <h1 class="text-2xl font-semibold text-slate-900">
          @if (v.firstRound) { Your first calibration curve } @else { Your calibration so far }
        </h1>
      </div>

      <section class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <app-calibration-chart
          [scale]="v.scale"
          [lifetime]="v.firstRound ? null : v.lifetime"
          [round]="v.round"
          [roundBars]="v.firstRound"
        />
        <div class="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          @if (!v.firstRound) {
            <span><span class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-indigo-600"></span>Before this round ({{ v.lifetimeSummary.n }} answers)</span>
          }
          <span><span class="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-amber-600"></span>This round</span>
          <span>Bars: where your true hit rate plausibly sits (95%)</span>
        </div>
        @if (v.firstRound) {
          <p class="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            One round is too few answers to say much: see how wide the bars are. Play a few more rounds and this chart
            becomes your lifetime curve.
          </p>
        }
      </section>

      <section class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs uppercase tracking-wide text-slate-400">Brier score (lower is better)</p>
          <p class="text-3xl font-semibold text-slate-900">{{ v.roundSummary.brier | number: '1.2-2' }}</p>
          @if (!v.firstRound) {
            <p class="text-sm text-slate-500">before this round: {{ v.lifetimeSummary.brier | number: '1.2-2' }}</p>
          }
          <div class="relative mt-4 h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-400">
            <span class="absolute -top-1 h-4 w-1 rounded bg-slate-900" [style.left.%]="(v.roundSummary.brier ?? 0) * 100"></span>
            <span class="absolute -top-1 h-4 w-0.5 bg-white" [style.left.%]="v.scale.chanceBrier * 100"></span>
          </div>
          <div class="relative mt-1 h-4 text-[10px] text-slate-400">
            <span class="absolute left-0">0 perfect</span>
            <span class="absolute -translate-x-1/2" [style.left.%]="v.scale.chanceBrier * 100">{{ v.scale.chanceBrier | number: '1.2-2' }} guessing</span>
            <span class="absolute right-0">1 worst</span>
          </div>
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p class="text-xs uppercase tracking-wide text-slate-400">Confidence vs. accuracy</p>
          <p class="text-lg font-semibold text-slate-900">{{ phrase(v.roundSummary) }}</p>
          <p class="text-sm text-slate-500">
            avg. confidence {{ v.roundSummary.meanConfidence | number: '1.0-0' }}% · right {{ v.roundSummary.pctCorrect | number: '1.0-0' }}%
          </p>
          @if (!v.firstRound) {
            <p class="mt-2 text-sm text-slate-500">before this round: {{ phrase(v.lifetimeSummary) }}</p>
          }
        </div>
      </section>

      <details class="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <summary class="cursor-pointer p-4 font-medium text-slate-800">Review the {{ v.items.length }} items</summary>
        <ul class="divide-y divide-slate-100 border-t border-slate-100">
          @for (it of v.items; track it.id) {
            <li class="flex items-start gap-3 px-4 py-2 text-sm">
              <span [class]="it.correct ? 'text-emerald-600' : 'text-rose-600'">{{ it.correct ? '✓' : '✗' }}</span>
              <div class="flex-1">
                <p class="text-slate-800">{{ it.prompt }}</p>
                <p class="text-slate-500">
                  You: {{ it.pick }} at {{ it.confidence }}%
                  @if (!it.correct) { · answer: {{ it.answer }} }
                </p>
              </div>
              @if (flag(it); as f) {
                <span class="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{{ f }}</span>
              }
            </li>
          }
        </ul>
      </details>
    </div>
  `,
})
export class VariantALifetimeHero {
  readonly view = input.required<ResultsView>();
  readonly phrase = overUnderPhrase;
  flag(it: Parameters<typeof flagFor>[0]) {
    return flagFor(it, this.view().format);
  }
}
