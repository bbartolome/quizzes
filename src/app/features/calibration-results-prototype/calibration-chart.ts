// PROTOTYPE: hand-rolled SVG calibration curve. Lifetime = filled + Wilson bars; round = hollow ghost.
import { Component, computed, input } from '@angular/core';
import { Bucket, Scale } from './prototype-results-data';

const W = 360;
const H = 290;
const M = { l: 44, r: 14, t: 14, b: 54 };

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: 'app-calibration-chart',
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-full" role="img" aria-label="Calibration curve">
      <!-- shaded halves -->
      <polygon [attr.points]="underPoly()" class="fill-sky-50" />
      <polygon [attr.points]="overPoly()" class="fill-rose-50" />
      <text [attr.x]="x(scale().xMin) + 6" [attr.y]="y(92)" class="fill-sky-400 text-[10px]">underconfident</text>
      <text [attr.x]="x(scale().xMax) - 6" [attr.y]="y(6)" text-anchor="end" class="fill-rose-400 text-[10px]">overconfident</text>

      <!-- grid + axes -->
      @for (t of yTicks; track t) {
        <line [attr.x1]="M.l" [attr.x2]="W - M.r" [attr.y1]="y(t)" [attr.y2]="y(t)" class="stroke-slate-200" />
        <text [attr.x]="M.l - 6" [attr.y]="y(t) + 3" text-anchor="end" class="fill-slate-400 text-[10px]">{{ t }}%</text>
      }
      @for (b of axisBuckets(); track b.level) {
        <text [attr.x]="x(b.level)" [attr.y]="H - M.b + 14" text-anchor="middle" class="fill-slate-500 text-[10px]">{{ b.level }}%</text>
        <text [attr.x]="x(b.level)" [attr.y]="H - M.b + 27" text-anchor="middle" class="text-[9px]" [class]="b.n ? 'fill-slate-500' : 'fill-slate-300'">
          n={{ b.n }}
        </text>
      }
      <text [attr.x]="(M.l + W - M.r) / 2" [attr.y]="H - 6" text-anchor="middle" class="fill-slate-500 text-[10px]">Your confidence</text>
      <text [attr.x]="12" [attr.y]="(M.t + H - M.b) / 2" text-anchor="middle" class="fill-slate-500 text-[10px]"
        [attr.transform]="'rotate(-90 12 ' + (M.t + H - M.b) / 2 + ')'">Actually right</text>

      <!-- chance + diagonal -->
      <line [attr.x1]="M.l" [attr.x2]="W - M.r" [attr.y1]="y(scale().chance)" [attr.y2]="y(scale().chance)" class="stroke-slate-400" stroke-dasharray="2 3" />
      <text [attr.x]="W - M.r - 4" [attr.y]="y(scale().chance) - 3" text-anchor="end" class="fill-slate-400 text-[9px]">chance</text>
      <line [attr.x1]="x(scale().xMin)" [attr.y1]="y(scale().xMin)" [attr.x2]="x(scale().xMax)" [attr.y2]="y(scale().xMax)" class="stroke-slate-500" stroke-dasharray="5 4" />

      <!-- lifetime -->
      @if (lifetime(); as lt) {
        @for (s of segs(lt); track $index) {
          <line [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" class="stroke-indigo-600" stroke-width="2" />
        }
        @for (b of lt; track b.level) {
          @if (b.rate !== null) {
            <line [attr.x1]="x(b.level)" [attr.x2]="x(b.level)" [attr.y1]="y(b.lo!)" [attr.y2]="y(b.hi!)" class="stroke-indigo-300" stroke-width="6" stroke-linecap="round" />
            <circle [attr.cx]="x(b.level)" [attr.cy]="y(b.rate)" r="5" class="fill-indigo-600" />
          }
        }
      }

      <!-- round -->
      @if (round(); as rd) {
        @for (s of segs(rd, roundOffset()); track $index) {
          <line [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" class="stroke-amber-500" stroke-width="1.5" stroke-dasharray="4 3" />
        }
        @for (b of rd; track b.level) {
          @if (b.rate !== null) {
            @if (roundBars()) {
              <line [attr.x1]="x(b.level) + roundOffset()" [attr.x2]="x(b.level) + roundOffset()" [attr.y1]="y(b.lo!)" [attr.y2]="y(b.hi!)" class="stroke-amber-300" stroke-width="4" stroke-linecap="round" />
            }
            <circle [attr.cx]="x(b.level) + roundOffset()" [attr.cy]="y(b.rate)" r="4.5" class="fill-white stroke-amber-600" stroke-width="2" />
            @if (b.level === 100 && b.hits < b.n) {
              <circle [attr.cx]="x(b.level) + roundOffset()" [attr.cy]="y(b.rate)" r="9" class="fill-none stroke-rose-500" stroke-width="1.5" />
            }
          }
        }
      }
    </svg>
  `,
})
export class CalibrationChart {
  readonly scale = input.required<Scale>();
  readonly lifetime = input<Bucket[] | null>(null);
  readonly round = input<Bucket[] | null>(null);
  /** Draw Wilson bars on round points too (only sensible when the round is shown alone). */
  readonly roundBars = input(false);

  readonly W = W;
  readonly H = H;
  readonly M = M;
  readonly yTicks = [0, 25, 50, 75, 100];

  /** n labels follow the lifetime when present, else the round. */
  readonly axisBuckets = computed(() => {
    const lt = this.lifetime();
    return lt && lt.some((b) => b.n) ? lt : (this.round() ?? lt ?? []);
  });
  readonly roundOffset = computed(() => (this.lifetime()?.some((b) => b.n) ? 7 : 0));

  x(v: number): number {
    const { xMin, xMax } = this.scale();
    const pad = 14;
    return M.l + pad + ((v - xMin) / (xMax - xMin)) * (W - M.l - M.r - 2 * pad);
  }

  y(v: number): number {
    return M.t + (1 - v / 100) * (H - M.t - M.b);
  }

  underPoly(): string {
    const { xMin, xMax } = this.scale();
    return [[xMin, xMin], [xMax, xMax], [xMax, 100], [xMin, 100]].map(([a, b]) => `${this.x(a)},${this.y(b)}`).join(' ');
  }

  overPoly(): string {
    const { xMin, xMax } = this.scale();
    return [[xMin, 0], [xMax, 0], [xMax, xMax], [xMin, xMin]].map(([a, b]) => `${this.x(a)},${this.y(b)}`).join(' ');
  }

  /** Connect only adjacent non-empty buckets: the line never bridges a gap. */
  segs(bs: Bucket[], dx = 0): Seg[] {
    const out: Seg[] = [];
    for (let i = 1; i < bs.length; i++) {
      const a = bs[i - 1];
      const b = bs[i];
      if (a.rate === null || b.rate === null) continue;
      out.push({ x1: this.x(a.level) + dx, y1: this.y(a.rate), x2: this.x(b.level) + dx, y2: this.y(b.rate) });
    }
    return out;
  }
}
