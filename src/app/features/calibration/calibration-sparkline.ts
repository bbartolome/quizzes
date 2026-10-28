import { Component, computed, input } from '@angular/core';
import { chartGeometry } from './chart-geometry';

type CalibrationFormat = Parameters<typeof chartGeometry>[0];
type BucketStat = Parameters<typeof chartGeometry>[1][number];

@Component({
  selector: 'app-calibration-sparkline',
  template: `
    <svg
      role="img"
      aria-label="Lifetime calibration curve"
      [attr.viewBox]="'0 0 160 100'"
      class="h-24 w-40"
    >
      <line
        data-diagonal
        [attr.x1]="g().diagonal.x1"
        [attr.y1]="g().diagonal.y1"
        [attr.x2]="g().diagonal.x2"
        [attr.y2]="g().diagonal.y2"
        class="stroke-strong"
      />
      @for (segment of g().segments; track segment) {
        <line
          [attr.x1]="segment.x1"
          [attr.y1]="segment.y1"
          [attr.x2]="segment.x2"
          [attr.y2]="segment.y2"
          class="stroke-text stroke-2"
        />
      }
      @for (point of g().points; track point) {
        <circle data-point r="3" [attr.cx]="point.x" [attr.cy]="point.y" class="fill-text" />
      }
    </svg>
  `,
})
export class CalibrationSparkline {
  readonly box = {
    width: 160,
    height: 100,
    pad: { top: 6, right: 6, bottom: 6, left: 6 },
  };

  readonly format = input.required<CalibrationFormat>();
  readonly buckets = input.required<BucketStat[]>();

  readonly g = computed(() => chartGeometry(this.format(), this.buckets(), null, this.box));
}
