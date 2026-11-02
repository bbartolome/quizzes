import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CLOCK } from '../../core/app-clock';
import { PracticeSnapshot } from '../../core/models/practice.models';
import { PracticeService } from '../../core/services/practice.service';
import { Button } from '../../shared/ui/button.directive';
import { Card } from '../../shared/ui/card.directive';
import { QuizCard, routeFor } from './library-cards';

/** Local days in the "This week" line: today and the six before it. */
const WEEK_DAYS = 7;

@Component({
  selector: 'app-today-panel',
  imports: [RouterLink, Button, Card],
  template: `
    <div uiCard class="space-y-4" data-testid="today-panel">
      <h2 class="type-section">Today</h2>

      @if (snapshot().enabled) {
        <div class="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p class="type-eyebrow">Practice streak</p>
            @if (snapshot().streak > 0) {
              <p class="type-stat" data-testid="practice-streak">{{ snapshot().streak }}</p>
            } @else {
              <p class="type-body">Practise today to start a streak</p>
            }
          </div>
          <div>
            <p class="type-eyebrow">Rest days</p>
            <p class="type-stat" data-testid="rest-days">{{ snapshot().restDays }}</p>
          </div>
        </div>
      }

      @if (suggested(); as pick) {
        <p class="type-body">
          Suggested today:
          <a
            uiButton
            variant="link"
            data-testid="suggested-today"
            [routerLink]="routeFor(pick.entry)"
            >{{ pick.entry.title }}</a
          >
        </p>
      }

      <p class="type-detail" data-testid="this-week">This week: {{ weekText() }}</p>

      <label class="flex items-center gap-2 type-detail">
        <input
          type="checkbox"
          data-testid="hide-streak-toggle"
          class="rounded focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface"
          [checked]="!snapshot().enabled"
          (change)="onToggle($event)"
        />
        Hide streak and badges
      </label>

      @if (saveFailed()) {
        <p class="type-detail text-danger" data-testid="save-failed">
          Progress can't be saved in this browser.
        </p>
      }
    </div>
  `,
})
export class TodayPanel {
  readonly cards = input<readonly QuizCard[] | null>(null);

  private readonly practice: PracticeService = inject(PracticeService);
  private readonly clock = inject(APP_CLOCK);
  private readonly lastPlayed = this.practice.lastPlayed();

  protected readonly saveFailed = this.practice.saveFailed;
  protected readonly routeFor = routeFor;
  protected readonly snapshot = signal<PracticeSnapshot>(this.practice.snapshot(this.clock()));

  /** The quiz played longest ago. A quiz with no entry is never played, so it wins. */
  protected readonly suggested = computed<QuizCard | null>(() => {
    let best: QuizCard | null = null;
    let bestAt = Infinity;
    for (const card of this.cards() ?? []) {
      const at = this.playedAt(card);
      if (best === null || at < bestAt) {
        best = card;
        bestAt = at;
      }
    }
    return best;
  });

  protected readonly weekText = computed(() => {
    const now = this.clock();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (WEEK_DAYS - 1),
    ).getTime();
    const titles = (this.cards() ?? [])
      .filter((card) => this.playedAt(card) >= start)
      .map((card) => card.entry.title);
    return titles.length ? titles.join(', ') : 'nothing played yet';
  });

  protected onToggle(event: Event): void {
    const hidden = (event.target as HTMLInputElement).checked;
    this.practice.setEnabled(!hidden);
    this.snapshot.set(this.practice.snapshot(this.clock()));
  }

  /** Epoch milliseconds of the last play; -Infinity when the quiz has no entry. */
  private playedAt(card: QuizCard): number {
    const iso = this.lastPlayed[card.entry.id];
    const at = iso === undefined ? NaN : Date.parse(iso);
    return Number.isNaN(at) ? -Infinity : at;
  }
}
