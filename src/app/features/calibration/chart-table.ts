import { Component, computed, input } from '@angular/core';
import type { BucketStat } from './calibration.models';

@Component({
  selector: 'app-chart-table',
  template: `
    <table class="w-full text-sm text-text">
      <thead>
        <tr>
          <th class="type-caption pb-2 text-left font-medium">Confidence</th>
          <th class="type-caption pb-2 text-right font-medium">Answers</th>
          <th class="type-caption pb-2 text-right font-medium">% correct</th>
          <th class="type-caption pb-2 text-right font-medium">95% range</th>
          <th class="type-caption pb-2 text-right font-medium">This round</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.stop) {
          <tr>
            <td class="border-b border-default py-2 text-left">{{ row.stop }}</td>
            <td class="border-b border-default py-2 text-right tabular-nums">{{ row.n }}</td>
            <td class="border-b border-default py-2 text-right tabular-nums">{{ row.pct }}</td>
            <td class="border-b border-default py-2 text-right tabular-nums">{{ row.range }}</td>
            <td class="border-b border-default py-2 text-right tabular-nums">{{ row.round }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class ChartTable {
  buckets = input.required<BucketStat[]>();
  overlay = input<BucketStat[] | null>(null);

  rows = computed(() =>
    this.buckets().map((b) => {
      const o = this.overlay()?.find((x) => x.stop === b.stop);
      return {
        stop: `${b.stop}%`,
        n: b.n,
        pct: b.pct === null ? '—' : `${Math.round(b.pct)}%`,
        range: b.lo === null || b.hi === null ? '—' : `${Math.round(b.lo)}–${Math.round(b.hi)}%`,
        round: o && o.n > 0 ? `${o.hits}/${o.n}` : '—',
      };
    }),
  );
}
