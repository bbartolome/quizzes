import { Component, computed, input } from '@angular/core';
import type { BucketStat } from './calibration.models';

@Component({
  selector: 'app-chart-table',
  template: `
    <table class="w-full text-sm">
      <thead>
        <tr>
          <th>Confidence</th>
          <th>Answers</th>
          <th>% correct</th>
          <th>95% range</th>
          <th>This round</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.stop) {
          <tr>
            <td>{{ row.stop }}</td>
            <td>{{ row.n }}</td>
            <td>{{ row.pct }}</td>
            <td>{{ row.range }}</td>
            <td>{{ row.round }}</td>
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
