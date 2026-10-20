import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FORMATS } from './calibration-format';
import type { CalibrationFormat } from './calibration.models';
import type { ScoreSide } from './score-side';

@Component({
  selector: 'app-skill-score-card',
  standalone: true,
  templateUrl: './skill-score-card.html',
  imports: [DecimalPipe],
})
export class SkillScoreCard {
  format = input.required<CalibrationFormat>();
  side = input.required<ScoreSide>();
  before = input<ScoreSide | null>(null);
  delta = input<number | null>(null);

  config = computed(() => FORMATS[this.format()]);
  markerLeft = computed(() => `${Math.min(100, Math.max(0, this.side().skill))}%`);
  chanceLeft = computed(() => `${this.config().chance}%`);

  deltaText = computed(() => {
    const d = this.delta();
    return d === null ? '' : d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '0';
  });
}
