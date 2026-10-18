// PROTOTYPE — throwaway. Question: what does answering a calibration item feel like?
// Three variants of the calibration round, switchable via ?variant=A|B|C, on /prototype/calibration-round.
// Real route will be calibration/:id/round. State is in memory only.
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, tap } from 'rxjs';
import { JsonPipe } from '@angular/common';
import { PrototypeSwitcher, PrototypeVariant } from '../../shared/prototype-switcher';
import { PROTO_ITEMS, ProtoAnswer, emptyAnswers } from './prototype-items';
import { VariantADeck } from './variant-a-deck';
import { VariantBBipolar } from './variant-b-bipolar';
import { VariantCSheet } from './variant-c-sheet';

@Component({
  selector: 'app-calibration-round-prototype-page',
  imports: [PrototypeSwitcher, VariantADeck, VariantBBipolar, VariantCSheet, JsonPipe],
  template: `
    <div class="min-h-screen bg-slate-50 pb-24">
      <header class="border-b border-slate-200 bg-white px-4 py-3">
        <p class="text-xs uppercase tracking-wide text-slate-400">Confidence · prototype round</p>
      </header>

      @if (finished()) {
        <div class="mx-auto max-w-xl space-y-4 p-6 text-center">
          <h2 class="text-2xl font-semibold text-slate-900">Round complete</h2>
          <p class="text-slate-600">You answered {{ items.length }} items. Here's how calibrated you were…</p>
          <button type="button" class="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white">
            See results (stub)
          </button>
          <div>
            <button type="button" class="text-sm text-slate-500 underline" (click)="reset()">Play this variant again</button>
          </div>
        </div>
      } @else {
        @switch (variant()) {
          @case ('B') {
            <app-variant-b-bipolar [(answers)]="answers" (finished)="finished.set(true)" />
          }
          @case ('C') {
            <app-variant-c-sheet [(answers)]="answers" (finished)="finished.set(true)" />
          }
          @default {
            <app-variant-a-deck [(answers)]="answers" (finished)="finished.set(true)" />
          }
        }
      }

      <details class="mx-auto mt-8 max-w-3xl px-4 text-xs text-slate-500">
        <summary class="cursor-pointer">Prototype state</summary>
        <pre class="mt-2 overflow-auto rounded bg-slate-900 p-3 text-slate-100">{{ { variant: variant(), finished: finished(), answers: answers() } | json }}</pre>
      </details>

      <app-prototype-switcher [variants]="variants" [current]="variant()" />
    </div>
  `,
})
export class CalibrationRoundPrototypePage {
  private readonly route = inject(ActivatedRoute);

  readonly items = PROTO_ITEMS;
  readonly variants: PrototypeVariant[] = [
    { key: 'A', name: 'One at a time, two steps' },
    { key: 'B', name: 'One tap, bipolar scale' },
    { key: 'C', name: 'Whole-round worksheet' },
  ];
  readonly answers = signal<ProtoAnswer[]>(emptyAnswers());
  readonly finished = signal(false);
  readonly variant = toSignal(
    this.route.queryParamMap.pipe(
      map((q) => q.get('variant') ?? 'A'),
      tap(() => this.reset()),
    ),
    { initialValue: 'A' },
  );

  reset(): void {
    this.answers.set(emptyAnswers());
    this.finished.set(false);
  }
}
