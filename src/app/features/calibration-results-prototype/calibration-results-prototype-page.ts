// PROTOTYPE — throwaway. Question: what does the end-of-round calibration report look like?
// Three variants switchable via ?variant=A|B|C on /prototype/calibration-results.
// Fixture toggles: ?format=two-way|four-way &history=first|some|rich &round=normal|sparse.
// Real route will be calibration/:id/results. In-memory fixtures only.
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { JsonPipe } from '@angular/common';
import { PrototypeSwitcher, PrototypeVariant } from '../../shared/prototype-switcher';
import { Format, HistoryLevel, RoundShape, buildView } from './prototype-results-data';
import { VariantALifetimeHero } from './variant-a-lifetime-hero';
import { VariantBVerdict } from './variant-b-verdict';
import { VariantCLedger } from './variant-c-ledger';

@Component({
  selector: 'app-calibration-results-prototype-page',
  imports: [PrototypeSwitcher, RouterLink, JsonPipe, VariantALifetimeHero, VariantBVerdict, VariantCLedger],
  template: `
    <div class="min-h-screen bg-slate-50 pb-24">
      <header class="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-dashed border-yellow-400 bg-yellow-50 px-4 py-2 text-xs">
        <span class="font-semibold uppercase tracking-wide text-yellow-800">Prototype fixtures</span>
        @for (t of toggles; track t.key) {
          <span class="flex items-center gap-1">
            <span class="text-slate-500">{{ t.key }}:</span>
            @for (o of t.options; track o) {
              <a [routerLink]="[]" [queryParams]="qp(t.key, o)" queryParamsHandling="merge" replaceUrl
                class="rounded px-1.5 py-0.5" [class]="params()[t.key] === o ? 'bg-yellow-400 font-semibold text-black' : 'text-slate-600 hover:bg-yellow-100'">{{ o }}</a>
            }
          </span>
        }
      </header>

      @switch (params().variant) {
        @case ('B') { <app-variant-b-verdict [view]="view()" /> }
        @case ('C') { <app-variant-c-ledger [view]="view()" /> }
        @default { <app-variant-a-lifetime-hero [view]="view()" /> }
      }

      <details class="mx-auto mt-8 max-w-3xl px-4 text-xs text-slate-500">
        <summary class="cursor-pointer">Prototype state</summary>
        <pre class="mt-2 overflow-auto rounded bg-slate-900 p-3 text-slate-100">{{ { params: params(), round: view().round, lifetime: view().lifetime, roundSummary: view().roundSummary, lifetimeSummary: view().lifetimeSummary } | json }}</pre>
      </details>

      <app-prototype-switcher [variants]="variants" [current]="params().variant" />
    </div>
  `,
})
export class CalibrationResultsPrototypePage {
  private readonly route = inject(ActivatedRoute);

  readonly variants: PrototypeVariant[] = [
    { key: 'A', name: 'Lifetime hero' },
    { key: 'B', name: 'Verdict first' },
    { key: 'C', name: 'Bucket ledger' },
  ];
  readonly toggles = [
    { key: 'format', options: ['two-way', 'four-way'] },
    { key: 'history', options: ['first', 'some', 'rich'] },
    { key: 'round', options: ['normal', 'sparse'] },
  ] as const;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly params = computed(() => {
    const q = this.query();
    return {
      variant: q.get('variant') ?? 'A',
      format: (q.get('format') ?? 'two-way') as Format,
      history: (q.get('history') ?? 'rich') as HistoryLevel,
      round: (q.get('round') ?? 'normal') as RoundShape,
    } as Record<string, string> & { variant: string; format: Format; history: HistoryLevel; round: RoundShape };
  });
  qp(key: string, value: string): Record<string, string> {
    return { [key]: value };
  }

  readonly view = computed(() => buildView(this.params().format, this.params().history, this.params().round));
}
