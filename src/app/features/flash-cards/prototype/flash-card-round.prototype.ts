// PROTOTYPE — throwaway. Answers "What does answering a flash card feel like?" (issue #17).
// Three variants of the flash card round page on the decided routes biases/:id/round and
// fallacies/:id/round, switchable via ?variant=A|B|C. Deck knobs via ?options=3|4,
// ?distractors=confused|random, ?pool=type|all. Everything in memory; End quiz just resets.
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { KnowledgeBaseEntry } from '../../../core/models/quiz.models';
import { PrototypeSwitcher } from './prototype-switcher';
import {
  Card,
  DeckSettings,
  Tip,
  buildCard,
  directionLabel,
  isCorrect,
  tipFor,
} from './flash-card-deck.prototype';

const VARIANTS: Record<string, string> = {
  A: 'Tap to answer',
  B: 'Feed, like Reasoning Traps',
  C: 'Flip card',
};

@Component({
  selector: 'app-flash-card-round-prototype',
  imports: [PrototypeSwitcher],
  template: `
    <div class="mx-auto w-full max-w-2xl space-y-6 p-4 pb-40 sm:p-6">
      <div class="flex items-baseline justify-between">
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">{{ title() }}</h1>
        <span class="text-sm text-slate-500">Card {{ cards().length }}</span>
      </div>

      @if (!ready()) {
        <p class="text-slate-500">Loading knowledge base…</p>
      } @else {
        @switch (variant()) {
          <!-- ───────────── A: one card, tap an option = answer ───────────── -->
          @case ('A') {
            @let card = current();
            @let tip = tipFor(card, kb());
            <section class="space-y-5">
              <div class="rounded-2xl bg-indigo-600 p-6 text-white shadow-lg">
                <p class="text-xs font-semibold uppercase tracking-widest text-indigo-200">
                  {{ directionLabel(card, conceptType()) }}
                </p>
                <p class="mt-3 text-xl font-semibold leading-snug" [class.text-3xl]="card.direction === 'term→definition'">
                  {{ card.direction === 'example→term' ? '“' + card.prompt + '”' : card.prompt }}
                </p>
              </div>

              <div class="space-y-3">
                @for (o of card.options; track o.entry.id) {
                  @let picked = card.chosen === o.entry.id;
                  @let answer = o.source === 'answer';
                  <button
                    type="button"
                    [disabled]="!!card.chosen"
                    (click)="answer_(o.entry.id)"
                    class="block w-full rounded-xl border-2 p-4 text-left text-slate-800 transition enabled:hover:border-indigo-400 enabled:hover:bg-indigo-50"
                    [class.border-slate-200]="!card.chosen || (!picked && !answer)"
                    [class.border-emerald-500]="card.chosen && answer"
                    [class.bg-emerald-50]="card.chosen && answer"
                    [class.border-rose-500]="picked && !answer"
                    [class.bg-rose-50]="picked && !answer"
                    [class.opacity-50]="card.chosen && !picked && !answer"
                  >
                    {{ o.label }}
                    @if (card.chosen && answer) { <span class="float-right text-emerald-600">✓</span> }
                    @if (picked && !answer) { <span class="float-right text-rose-600">✗</span> }
                  </button>
                }
              </div>

              @if (card.chosen) {
                <div class="space-y-3 rounded-xl border-l-4 p-4 text-sm"
                     [class.border-emerald-500]="isCorrect(card)" [class.bg-emerald-50]="isCorrect(card)"
                     [class.border-rose-500]="!isCorrect(card)" [class.bg-rose-50]="!isCorrect(card)">
                  <p class="text-base font-semibold">
                    {{ isCorrect(card) ? 'Correct' : 'Not quite: it’s ' + card.target.name }}
                  </p>
                  @if (tip.kind === 'pair' || tip.kind === 'confused') {
                    <p class="font-semibold text-slate-800">{{ card.target.name }} vs {{ tip.lure?.name }}</p>
                    <p class="text-slate-700">{{ tip.text }}</p>
                  } @else if (tip.kind === 'fallback') {
                    <p class="font-semibold text-slate-800">{{ card.target.name }} vs {{ tip.lure!.name }}</p>
                    <p class="text-slate-700"><b>{{ card.target.name }}:</b> {{ card.target.shortDefinition }}</p>
                    <p class="text-slate-700"><b>{{ tip.lure!.name }}:</b> {{ tip.lure!.shortDefinition }}</p>
                    <p class="text-xs italic text-fuchsia-700">Prototype: no authored tip for this pair; showing both definitions.</p>
                  } @else {
                    <p class="text-slate-700">{{ card.target.shortDefinition }}</p>
                  }
                  <div class="flex justify-end">
                    <button type="button" (click)="next()" class="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                      Next card →
                    </button>
                  </div>
                </div>
              }
            </section>
          }

          <!-- ───────────── B: scrolling feed, radio + Check answer ───────────── -->
          @case ('B') {
            <div class="space-y-8">
              @for (card of cards(); track card.serial; let last = $last) {
                @let tip = tipFor(card, kb());
                <fieldset class="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  <legend class="px-1 text-base font-semibold text-slate-800">
                    {{ directionLabel(card, conceptType()) }}
                  </legend>
                  <p class="rounded-md bg-slate-100 p-3 text-slate-800" [class.italic]="card.direction === 'example→term'"
                     [class.text-lg]="card.direction === 'term→definition'" [class.font-semibold]="card.direction === 'term→definition'">
                    {{ card.prompt }}
                  </p>
                  @for (o of card.options; track o.entry.id) {
                    <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-slate-700 hover:bg-slate-50">
                      <input type="radio" [name]="'card-' + card.serial" class="h-5 w-5 text-indigo-600"
                             [checked]="selected()[card.serial] === o.entry.id"
                             [disabled]="!!card.chosen"
                             (change)="select(card.serial, o.entry.id)" />
                      <span class="flex-1">{{ o.label }}</span>
                      @if (card.chosen) {
                        <span class="text-sm font-medium text-slate-500">
                          {{ o.source === 'answer' ? 'Correct answer' : card.chosen === o.entry.id ? 'Your pick' : '' }}
                        </span>
                      }
                    </label>
                  }
                  @if (card.chosen) {
                    <div class="space-y-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                      <p class="font-semibold">{{ isCorrect(card) ? 'Correct' : 'Incorrect' }}</p>
                      <p>Answer: {{ card.target.name }}</p>
                      <p>{{ card.target.longExplanation }}</p>
                      @if (tip.kind === 'pair' || tip.kind === 'confused') {
                        <p>{{ card.target.name }} vs {{ tip.lure?.name }}: {{ tip.text }}</p>
                      } @else if (tip.kind === 'fallback') {
                        <p>{{ tip.lure!.name }}: {{ tip.lure!.shortDefinition }}</p>
                        <p class="text-xs italic text-fuchsia-700">Prototype: no authored tip for this pair.</p>
                      }
                    </div>
                  } @else if (last) {
                    <div class="flex justify-end">
                      <button type="button" [disabled]="!selected()[card.serial]" (click)="checkB(card.serial)"
                              class="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-slate-300">
                        Check answer
                      </button>
                    </div>
                  }
                </fieldset>
              }
            </div>
          }

          <!-- ───────────── C: flip card, 2×2 tiles, back = side-by-side compare ───────────── -->
          @case ('C') {
            @let card = current();
            @let tip = tipFor(card, kb());
            @let lure = tip.lure;
            @if (!card.chosen) {
              <section class="flex min-h-[28rem] flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-400">
                  <span>{{ card.direction === 'term→definition' ? 'Term' : card.direction === 'example→term' ? 'Example' : 'Definition' }}</span>
                  <span>→ {{ card.direction === 'term→definition' ? 'pick the definition' : 'pick the term' }}</span>
                </div>
                <p class="my-auto py-8 text-center text-2xl font-semibold text-slate-900">{{ card.prompt }}</p>
                <div class="grid grid-cols-2 gap-3">
                  @for (o of card.options; track o.entry.id) {
                    <button type="button" (click)="select(card.serial, o.entry.id)"
                            class="min-h-20 rounded-xl border-2 p-3 text-sm text-slate-800 transition hover:border-indigo-300"
                            [class.border-indigo-600]="selected()[card.serial] === o.entry.id"
                            [class.bg-indigo-50]="selected()[card.serial] === o.entry.id"
                            [class.border-slate-200]="selected()[card.serial] !== o.entry.id">
                      {{ o.label }}
                    </button>
                  }
                </div>
                <button type="button" [disabled]="!selected()[card.serial]" (click)="checkB(card.serial)"
                        class="mt-4 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-slate-300">
                  Flip
                </button>
              </section>
            } @else {
              <section class="flex min-h-[28rem] flex-col gap-4 rounded-3xl p-6 shadow-xl"
                       [class.bg-emerald-50]="isCorrect(card)" [class.bg-rose-50]="!isCorrect(card)">
                <p class="text-center text-sm font-semibold uppercase tracking-widest"
                   [class.text-emerald-700]="isCorrect(card)" [class.text-rose-700]="!isCorrect(card)">
                  {{ isCorrect(card) ? '✓ Correct' : '✗ You picked ' + lure?.name }}
                </p>
                <h2 class="text-center text-3xl font-bold text-slate-900">{{ card.target.name }}</h2>
                @if (lure) {
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    @for (e of [card.target, lure]; track e.id; let first = $first) {
                      <div class="space-y-2 rounded-xl bg-white p-3" [class.ring-2]="first" [class.ring-emerald-400]="first">
                        <p class="font-semibold text-slate-900">{{ e.name }}</p>
                        <p class="text-slate-700">{{ e.shortDefinition }}</p>
                        <p class="italic text-slate-500">“{{ e.example }}”</p>
                      </div>
                    }
                  </div>
                }
                @if (tip.text) {
                  <p class="rounded-xl bg-white p-4 text-sm text-slate-700"><b>How to tell them apart:</b> {{ tip.text }}</p>
                } @else if (tip.kind === 'fallback') {
                  <p class="text-xs italic text-fuchsia-700">Prototype: no authored tip for this pair; the side-by-side is all we have.</p>
                } @else {
                  <p class="rounded-xl bg-white p-4 text-sm text-slate-700">{{ card.target.shortDefinition }}<br /><i class="text-slate-500">“{{ card.target.example }}”</i></p>
                }
                <button type="button" (click)="next()" class="mt-auto rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
                  Next card
                </button>
              </section>
            }
          }
        }
      }
    </div>

    <!-- PROTOTYPE state panel -->
    <aside class="fixed right-3 top-3 z-40 w-72 rounded-lg border-2 border-fuchsia-400 bg-white/95 p-3 text-xs text-slate-700 shadow-lg">
      <p class="mb-2 font-bold text-fuchsia-700">PROTOTYPE knobs</p>
      <div class="mb-1 flex gap-1">
        <span class="w-20">Options</span>
        @for (n of [3, 4]; track n) {
          <button class="rounded border px-2" [class.bg-fuchsia-100]="settings().options === n" (click)="setParam('options', n)">{{ n }}</button>
        }
      </div>
      <div class="mb-1 flex gap-1">
        <span class="w-20">Distractors</span>
        @for (d of ['confused', 'random']; track d) {
          <button class="rounded border px-2" [class.bg-fuchsia-100]="settings().distractors === d" (click)="setParam('distractors', d)">{{ d }}</button>
        }
      </div>
      <div class="mb-2 flex gap-1">
        <span class="w-20">Pool</span>
        @for (p of ['type', 'all']; track p) {
          <button class="rounded border px-2" [class.bg-fuchsia-100]="settings().pool === p" (click)="setParam('pool', p)">{{ p === 'type' ? 'same type' : 'both types' }}</button>
        }
      </div>
      @if (ready()) {
        <pre class="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-2 font-mono text-[10px] leading-tight">{{ stateDump() }}</pre>
      }
    </aside>

    <div class="fixed inset-x-0 bottom-0 flex items-center justify-between border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <span class="text-sm font-semibold text-slate-700">{{ score().correct }} / {{ score().answered }} correct</span>
      <button type="button" (click)="restart()" class="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
        End quiz
      </button>
    </div>

    <app-prototype-switcher [names]="variants" [current]="variant()" />
  `,
})
export class FlashCardRoundPrototype implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  readonly variants = VARIANTS;
  readonly directionLabel = directionLabel;
  readonly isCorrect = isCorrect;
  readonly tipFor = (c: Card, kb: KnowledgeBaseEntry[]): Tip => tipFor(c, kb);

  readonly conceptType = signal<'bias' | 'fallacy'>(this.route.snapshot.data['conceptType']);
  readonly title = computed(() => (this.conceptType() === 'bias' ? 'Biases' : 'Fallacies'));
  readonly variant = computed(() => (this.query().get('variant') ?? 'A') in VARIANTS ? (this.query().get('variant') ?? 'A') : 'A');
  readonly settings = computed<DeckSettings>(() => ({
    options: Number(this.query().get('options') ?? 4),
    distractors: (this.query().get('distractors') as DeckSettings['distractors']) ?? 'confused',
    pool: (this.query().get('pool') as DeckSettings['pool']) ?? 'type',
  }));

  readonly kb = signal<KnowledgeBaseEntry[]>([]);
  readonly ready = computed(() => this.kb().length > 0 && this.cards().length > 0);
  readonly cards = signal<Card[]>([]);
  readonly selected = signal<Record<number, string>>({});
  readonly current = computed(() => this.cards()[this.cards().length - 1]);
  readonly score = computed(() => {
    const done = this.cards().filter((c) => c.chosen);
    return { correct: done.filter(isCorrect).length, answered: done.length };
  });
  readonly stateDump = computed(() => {
    const c = this.current();
    const tip = tipFor(c, this.kb());
    return JSON.stringify(
      {
        variant: this.variant(),
        conceptType: this.conceptType(),
        settings: this.settings(),
        card: {
          direction: c.direction,
          target: c.target.id,
          options: c.options.map((o) => `${o.entry.id} [${o.source}${o.entry.type !== c.target.type ? ', other type' : ''}]`),
          selected: this.selected()[c.serial] ?? null,
          chosen: c.chosen ?? null,
          tip: tip.kind + (tip.lure ? ` (${tip.lure.id})` : ''),
        },
        score: this.score(),
      },
      null,
      1,
    );
  });

  ngOnInit(): void {
    this.http.get<KnowledgeBaseEntry[]>('data/quizzes/reasoning-traps/knowledge-base.json').subscribe((kb) => {
      this.kb.set(kb);
      this.restart();
    });
  }

  setParam(key: string, value: string | number): void {
    this.router.navigate([], { queryParams: { [key]: value }, queryParamsHandling: 'merge', replaceUrl: true });
    queueMicrotask(() => this.restart());
  }

  restart(): void {
    this.selected.set({});
    this.cards.set([buildCard(this.kb(), this.conceptType(), this.settings(), 1)]);
  }

  next(): void {
    const prev = this.current();
    this.cards.update((cs) => [...cs, buildCard(this.kb(), this.conceptType(), this.settings(), prev.serial + 1, prev.target.id)]);
  }

  select(serial: number, id: string): void {
    this.selected.update((s) => ({ ...s, [serial]: id }));
  }

  // A: tapping answers immediately.
  answer_(id: string): void {
    this.select(this.current().serial, id);
    this.checkB(this.current().serial);
  }

  // B/C: commit the selection. B appends the next card straight away, like Reasoning Traps.
  checkB(serial: number): void {
    this.cards.update((cs) => cs.map((c) => (c.serial === serial ? { ...c, chosen: this.selected()[serial] } : c)));
    if (this.variant() === 'B') this.next();
  }
}
