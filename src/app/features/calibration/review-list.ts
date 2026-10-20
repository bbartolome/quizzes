import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ReviewSection } from './review-sections';

@Component({
  selector: 'app-review-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    @for (s of sections(); track s.group) {
      <details [open]="s.open" class="rounded-lg border bg-white p-3">
        <summary class="font-medium">{{ s.title }} ({{ s.rows.length }})</summary>

        @for (r of s.rows; track r.itemId) {
          <div class="mt-3 border-t pt-3">
            <p class="text-sm">
              <span class="font-semibold">{{ r.confidence }}%</span> {{ r.prompt }}
            </p>
            <p>Your answer: {{ r.pickLabel }}</p>
            @if (r.correctLabel) {
              <p>Correct answer: {{ r.correctLabel }}</p>
            }
            @for (f of r.facts; track $index) {
              <p class="text-sm text-gray-700">{{ f }}</p>
            }
            <a [href]="r.source.url" target="_blank" rel="noopener">{{ r.source.label }}</a>
            @for (t of r.flags; track t) {
              <span class="ml-2 rounded bg-red-100 px-1 text-xs">{{
                t === 'miss-at-100' ? 'Miss at 100%' : 'Below chance'
              }}</span>
            }
          </div>
        }
      </details>
    }
  `,
})
export class ReviewList {
  sections = input.required<ReviewSection[]>();
}
