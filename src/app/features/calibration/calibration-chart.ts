import { Component, computed, input, signal } from '@angular/core';

import { ChartTable } from './chart-table';
import { chartGeometry, DEFAULT_BOX } from './chart-geometry';
import type { BucketStat, CalibrationFormat } from './types';

@Component({
  selector: 'app-calibration-chart',
  standalone: true,
  templateUrl: './calibration-chart.html',
  imports: [ChartTable],
})
export class CalibrationChart {
  format = input.required<CalibrationFormat>();
  buckets = input.required<BucketStat[]>();
  overlay = input<BucketStat[] | null>(null);
  firstRound = input(false);

  readonly box = DEFAULT_BOX;

  geometry = computed(() =>
    chartGeometry(this.format(), this.buckets(), this.overlay()),
  );

  showTable = signal(false);

  toggleTable(): void {
    this.showTable.update((v) => !v);
  }

  ariaLabel = computed(
    () =>
      `Calibration chart: accuracy by confidence, ${this.buckets().reduce(
        (s, b) => s + b.n,
        0,
      )} answers`,
  );

  overlayPath = computed(
    () =>
      this.geometry().overlayPoints
        .map((p) => `${p.x},${p.y}`)
        .join(' '),
  );
}
