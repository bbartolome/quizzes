import { Component, computed, input, signal } from '@angular/core';

import { Button } from '../../shared/ui/button.directive';
import { ChartTable } from './chart-table';
import { chartGeometry, DEFAULT_BOX } from './chart-geometry';
import type { BucketStat, CalibrationFormat } from './calibration.models';

@Component({
  selector: 'app-calibration-chart',
  standalone: true,
  templateUrl: './calibration-chart.html',
  imports: [ChartTable, Button],
})
export class CalibrationChart {
  format = input.required<CalibrationFormat>();
  buckets = input.required<BucketStat[]>();
  overlay = input<BucketStat[] | null>(null);
  firstRound = input(false);

  readonly box = DEFAULT_BOX;

  // The two chart text roles (docs/specs/design-system.md §8). Labels name the regions;
  // captions are the axis labels, bucket counts and notes.
  readonly labelClass = 'text-xs font-semibold';
  readonly captionClass = 'type-caption';

  geometry = computed(() => chartGeometry(this.format(), this.buckets(), this.overlay()));

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

  overlayPath = computed(() =>
    this.geometry()
      .overlayPoints.map((p) => `${p.x},${p.y}`)
      .join(' '),
  );
}
