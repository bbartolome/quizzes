// PROTOTYPE variant C: no curve up front. One row per confidence level comparing what you said with how
// often you were right (round vs lifetime), items nested under each row. Chart behind a disclosure.
import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CalibrationChart } from './calibration-chart';
import { Bucket, ResultsView, ReviewItem, flagFor, overUnderPhrase } from './prototype-results-data';

@Component({
  selector: 'app-variant-c-ledger',
  imports: [CalibrationChart, DecimalPipe],
  template: `
    @let v = view();
    <div class="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">When you said X%, were you right X% of the time?</h1>
          <p class="text-sm text-slate-500">Tick = what you said. Dot = this round. Bar = your record before it (95% range).</p>
        </div>
      </header>

      <div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        @for (r of rows(); track r.level) {
          <details class="border-b border-slate-100 last:border-0" [attr.open]="r.flagged ? '' : null">
            <summary class="grid cursor-pointer grid-cols-[4rem_1fr_7rem] items-center gap-3 px-4 py-3 sm:grid-cols-[4rem_1fr_7rem_7rem]">
              <span class="font-mono text-lg font-semibold text-slate-800">{{ r.level }}%</span>
              <div class="relative h-6 rounded bg-slate-100">
                @if (r.life.lo !== null) {
                  <span class="absolute top-1.5 h-3 rounded bg-indigo-200" [style.left.%]="r.life.lo" [style.width.%]="r.life.hi! - r.life.lo"></span>
                  <span class="absolute top-1 h-4 w-0.5 bg-indigo-600" [style.left.%]="r.life.rate"></span>
                }
                <span class="absolute -top-0.5 h-7 w-0.5 bg-slate-900" [style.left.%]="r.level"></span>
                @if (r.round.rate !== null) {
                  <span class="absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-amber-600 bg-white" [style.left.%]="r.round.rate"
                    [class.ring-2]="r.flagged" [class.ring-rose-500]="r.flagged"></span>
                }
              </div>
              <span class="text-right text-sm text-slate-600">
                @if (r.round.n) { {{ r.round.hits }}/{{ r.round.n }} this round } @else { <span class="text-slate-300">none this round</span> }
              </span>
              <span class="hidden text-right text-sm text-slate-500 sm:block">
                @if (v.firstRound) { <span class="text-slate-300">no record yet</span> }
                @else if (r.life.n) { {{ r.life.rate | number: '1.0-0' }}% of {{ r.life.n }} }
                @else { <span class="text-slate-300">none yet</span> }
              </span>
            </summary>
            @if (r.items.length) {
              <ul class="space-y-1 bg-slate-50 px-4 py-2 text-sm">
                @for (it of r.items; track it.id) {
                  <li class="flex gap-2">
                    <span [class]="it.correct ? 'text-emerald-600' : 'text-rose-600'">{{ it.correct ? '✓' : '✗' }}</span>
                    <span class="flex-1 text-slate-700">{{ it.prompt }}</span>
                    <span class="text-slate-500">{{ it.pick }}@if (!it.correct) { → {{ it.answer }} }</span>
                    @if (flag(it); as f) {
                      <span class="rounded bg-rose-100 px-2 text-xs font-medium text-rose-700">{{ f }}</span>
                    }
                  </li>
                }
              </ul>
            }
          </details>
        }
      </div>

      <footer class="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <p>Overall: <strong>{{ phrase(v.roundSummary) }}</strong></p>
        <p>Brier {{ v.roundSummary.brier | number: '1.2-2' }} <span class="text-slate-400">(guessing = {{ v.scale.chanceBrier | number: '1.2-2' }})</span></p>
        @if (!v.firstRound) {
          <p>Before: {{ phrase(v.lifetimeSummary) }}, Brier {{ v.lifetimeSummary.brier | number: '1.2-2' }}</p>
        }
      </footer>

      <details class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <summary class="cursor-pointer font-medium text-slate-700">Show as a chart</summary>
        <app-calibration-chart [scale]="v.scale" [lifetime]="v.firstRound ? null : v.lifetime" [round]="v.round" [roundBars]="v.firstRound" />
      </details>
    </div>
  `,
})
export class VariantCLedger {
  readonly view = input.required<ResultsView>();
  readonly phrase = overUnderPhrase;

  readonly rows = computed(() => {
    const v = this.view();
    return v.scale.levels.map((level, i) => {
      const items = v.items.filter((it) => it.confidence === level);
      return {
        level,
        round: v.round[i] as Bucket,
        life: v.lifetime[i] as Bucket,
        items,
        flagged: items.some((it) => flagFor(it, v.format) !== null),
      };
    });
  });

  flag(it: ReviewItem) {
    return flagFor(it, this.view().format);
  }
}
