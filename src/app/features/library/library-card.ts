import { Component, input } from '@angular/core';
import { QuizCard, formatPercent } from './library-cards';

/** One collection card. The host `<a>` is styled and linked by the parent, so only the inner markup lives here. */
@Component({
  selector: 'a[appLibraryCard]',
  template: `
    <h3 class="type-card">{{ card().entry.title }}</h3>
    <p class="mt-1 type-detail">{{ card().entry.description }}</p>
    <dl class="mt-4 space-y-1 type-detail">
      <div class="flex justify-between">
        <dt>Rounds played</dt>
        <dd>
          <strong>{{ card().roundsPlayed }}</strong>
        </dd>
      </div>
      @if (card().kind !== 'calibration') {
        <div class="flex justify-between">
          <dt>Accuracy</dt>
          <dd>
            @if (card().accuracy; as acc) {
              <strong>{{ formatPercent(acc) }}</strong>
            }
          </dd>
        </div>
        <div class="flex justify-between">
          <dt>Current streak</dt>
          <dd>
            <strong>{{ card().streak }}</strong>
          </dd>
        </div>
      }
      @if (card().kind === 'calibration' && card().skillScore !== null) {
        <div class="flex justify-between">
          <dt>Skill score</dt>
          <dd>
            <strong>{{ card().skillScore }}</strong>
          </dd>
        </div>
      }
    </dl>
  `,
})
export class LibraryCard {
  readonly card = input.required<QuizCard>();
  protected readonly formatPercent = formatPercent;
}
