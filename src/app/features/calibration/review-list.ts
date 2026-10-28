import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Button } from '../../shared/ui/button.directive';
import { Card } from '../../shared/ui/card.directive';
import { StatusBadge } from '../../shared/ui/status-badge';
import type { ReviewSection } from './review-sections';

@Component({
  selector: 'app-review-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Button, Card, StatusBadge],
  template: `
    @for (s of sections(); track s.group) {
      <details [open]="s.open" uiCard tone="sunken">
        <summary class="type-card cursor-pointer">{{ s.title }} ({{ s.rows.length }})</summary>

        @for (r of s.rows; track r.itemId) {
          <div class="mt-3 space-y-1 border-t border-default pt-3">
            <p class="type-detail">
              <span class="font-semibold text-text">{{ r.confidence }}%</span> {{ r.prompt }}
            </p>
            <p class="type-body">Your answer: {{ r.pickLabel }}</p>
            @if (r.correctLabel) {
              <p class="type-body">Correct answer: {{ r.correctLabel }}</p>
            }
            @for (f of r.facts; track $index) {
              <p class="type-detail">{{ f }}</p>
            }
            <a uiButton variant="link" [href]="r.source.url" target="_blank" rel="noopener">{{
              r.source.label
            }}</a>
            @for (t of r.flags; track t) {
              <ui-status
                class="ml-2"
                tone="danger"
                [label]="t === 'miss-at-100' ? 'Miss at 100%' : 'Below chance'"
              />
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
