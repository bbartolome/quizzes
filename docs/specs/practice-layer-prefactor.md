# Spec: Practice layer pre-factor

Pre-factoring that lets `docs/specs/practice-layer.md` be implemented in parallel lanes. It is documentation: each R step is implemented separately, in the TDD style the practice-layer spec uses.

## Context

The spec's slice table (§12) is mostly a chain: P1 → P2 → P3 → {P5, P6, P7} → P8. Only P1 and P4 can start on day one. The causes are:

1. **No shared contract.** P3, P5, P6 and P7 all consume `PracticeService` and `PracticeState`, which only exist once P2 lands.
2. **One hotspot file.** `library-page.ts` and `library-page.html` are edited by P5, P6, P7 and P8, by game theory (`ROUTE_PREFIX`, `routeFor`), and by easier-quizzes (§3.6, the Basic card). The card building, the summary logic and the card markup all live inline in one component.
3. **Duplicated test scaffolding.** `MemoryStorage` is copied into 5 specs (`stats.service.spec.ts`, `library-page.spec.ts`, `calibration-round-page.spec.ts`, `calibration-home-page.spec.ts`, `calibration-history.service.spec.ts`). Every new slice would add another copy, and each slice would build its own fake clock and fake recorder.
4. **Unrelated fixes inside P3.** The calibration double-submit bug (§10.4) and the Traps round spec's missing `localStorage` reset (§10.3) don't depend on the recorder. Leaving them in P3 makes it bigger than it needs to be.

The pre-factor below doesn't change behaviour (except the R4 bug fix). Each step is a small commit on its own branch. After it lands, seven lanes can run at once.

## Pre-factor steps

They are independent of each other except R1 → R2. Run them in any order, or in parallel.

### R1. Test helpers in `src/testing/`

- `src/testing/memory-storage.ts`: the one `MemoryStorage implements Storage`. Replace the 5 copies with an import (a pure refactor; the specs stay green).
- `src/testing/fixed-clock.ts`: `provideFixedClock(iso: string)` returns a provider for `APP_CLOCK` (the token is added in R2).
- Add `"src/testing/**"` to `exclude` in `tsconfig.app.json`, so test-only code never reaches the app build.

### R2. Practice-layer contract (types, token, inert service)

This step unblocks every consumer lane. It contains no logic that P1, P2, P4 or P7 will test.

- `src/app/core/utils/dates.ts`: `export type DateKey = string;` only. P1 adds the functions.
- `src/app/core/app-clock.ts`: `APP_CLOCK = new InjectionToken<() => Date>('APP_CLOCK', { providedIn: 'root', factory: () => () => new Date() })`. This follows the `CALIBRATION_RNG` pattern in `features/calibration/draw.ts:13`.
- `src/app/core/models/practice.models.ts`: `AttemptInput`, `PracticeSnapshot`, `StreakState`, `PracticeState`, `MasteryState`, `ConceptEvidence`, `BadgeDef`, `BadgeContext`, `PRACTICE_KEY = 'stats:app:practice'`. Copy them from spec §3, §4.3, §5, §6 and §8 verbatim, except for the two widenings below.
- `src/app/core/services/practice.service.ts`: the full public surface, root-provided. The bodies are inert: `snapshot` and `recordAttempt` return a zeroed snapshot with `enabled: true`, and the read methods return empty values. P2 replaces the bodies but keeps the signatures.
- **Contract widenings the spec leaves implicit.** These are needed so consumer lanes don't reach into storage:
  - `lastPlayed(): Readonly<Record<string, string>>` (P5)
  - `conceptDays(): Readonly<Record<string, { days: number; lastDay: DateKey }>>` (P6, P7, game theory G9)
  - `badges(): Readonly<Record<string, { earnedAt: string; evidence: string }>>` and `recordBadges(earned: { id: string; evidence: string }[], now?: Date): void` (P7)
  - `saveFailed: Signal<boolean>` (or a field on the snapshot), for "Progress can't be saved in this browser" (§5, P5)
  - `BadgeContext.calibration` entries gain `format: CalibrationFormat`. §8 gives four-way answers different high and low thresholds (≥75 / ≤25 against ≥80 / ≤60), and the spec's shape can't tell the formats apart.
- `src/testing/fake-practice.service.ts`: an in-memory `FakePracticeService` with the same surface, which records calls (`attempts: {quizId, input}[]`) and lets a spec seed state. All consumer lanes mock against this.
- Record the widenings as a short amendment to `practice-layer.md` §3 and §8, so the reviewer's spec check passes.

### R3. Split up the library page (hotspot)

The DOM stays identical. `library-page.spec.ts`, including the `section a h3` assertion at `:389`, must pass unchanged.

- `features/library/library-cards.ts` (pure): move `QuizCard`, `ROUTE_PREFIX`, `routeFor`, and `toCard` split into `statsCard(entry, QuizStats)` and `calibrationCard(entry, summary)`. P6 adds `conceptsPractised` here. Game theory adds its `ROUTE_PREFIX` entry and `routeFor` case here.
- `features/library/library-summary.ts` (pure): move `summary$`'s loop as `summarize(cards)`. P5 changes "most recently played" here by adding a `lastPlayedAt` parameter.
- `features/library/library-card.ts`: an attribute component `a[appLibraryCard]` that holds the existing card markup (`uiCard interactive`, `<h3>`, `<dl>`), so the `section > a > h3` DOM is preserved. P6 (the "Concepts practised" row) and easier-quizzes edit only this file.
- `library-page.html` becomes four stacked regions inside `space-y-8`: summary `<p>`, _(Today panel slot)_, collections `<section>`, _(Insights slot)_, footer. Put a one-line comment at each slot, so P5 and P7 each add one element in different places and don't conflict.
- `library-page.ts` keeps orchestration only: loads, migrations, `resetAll`. The reset confirmation text moves to a `RESET_ALL_MESSAGE` constant, so P5's wording change is a one-line diff.
- Add unit specs for `summarize` and `statsCard`/`calibrationCard` that pin today's behaviour (the streak-then-rounds tie-break).

### R4. Get the round pages ready for the recorder (§10 items 3–4)

- `calibration-round-page.ts:168`: guard `submit()` with a `submitted` flag. Red test: a double `submit()` calls `history.submit` once. This is the spec's P3 bug fix, moved forward.
- `round-page.spec.ts`: add `vi.stubGlobal('localStorage', new MemoryStorage())` (from R1) in `beforeEach`.
- `round-page.ts`: extract `knowledgeBaseIds = computed(() => new Set(this.kb().concepts.map(c => c.id)))`. P3 then filters `traitIds` with one line, and `migrateVersion` reuses the set.

### R5. Stats rows ready for mastery

- `stats-rows.ts`: make `TraitRow` easy to extend (spread from a `baseRow`), so P6 can add `mastery: MasteryState` without restructuring. `pooledConceptCounts` stays in P4, where it's TDD'd.

## Lanes after the pre-factor

| Lane | Slices                                                        | Depends on                                                | Files owned                                                                   |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A    | P1 `dates.ts` + `practice-streak.ts`                          | R2                                                        | `core/utils/dates.ts`, `practice-streak.ts`                                   |
| B    | P2 real `PracticeService` body                                | R2 (P1 for the streak; stub until merged, or run after A) | `practice.service.ts`                                                         |
| C    | P3 wire 3 call sites                                          | R2, R4                                                    | 3 round pages and their specs                                                 |
| D    | P4 `masteryOf` + `pooledConceptCounts`                        | R2 types                                                  | `core/utils/mastery.ts`, `concept-counts.ts`                                  |
| E    | P5 Today panel, recently played, reset text                   | R2, R3                                                    | `today-panel.ts` (new), `library-summary.ts`, one slot in `library-page.html` |
| F    | P6 mastery glyphs + "N / M"                                   | R2, R3, R5; real numbers need D                           | `stats-rows.ts`, `stats-page.html`, `library-cards.ts`, `library-card.ts`     |
| G    | P7a `earnedBadges` + 4 badge defs (pure, types only)          | R2                                                        | `core/utils/badges.ts`                                                        |
| —    | P7b Insights list, results-screen line, `recordBadges` wiring | B, D, G                                                   | `insights-list.ts` (new), one slot, results pages                             |
| —    | P8 polish                                                     | all                                                       | —                                                                             |

Only Lane B needs real P1 output (it can start against the stubbed streak). Every UI lane tests against `FakePracticeService`, so lanes C–F don't wait on B. P7 splits into a pure P7a, which can run now, and a wiring step P7b.

Merge order to keep `main` green: R1 → R2 → (R3, R4, R5 in any order) → lanes in any order. B replaces only method bodies, so it never conflicts with C–G.

## Critical files

- `src/app/features/library/library-page.ts` / `.html` (split up in R3)
- `src/app/features/calibration/calibration-round-page.ts` (R4 guard)
- `src/app/features/round/round-page.ts` and `round-page.spec.ts` (R4)
- `src/app/features/stats/stats-rows.ts` (R5)
- New: `src/testing/*`, `src/app/core/app-clock.ts`, `core/models/practice.models.ts`, `core/services/practice.service.ts`, `core/utils/dates.ts`
- Reuse: `CALIBRATION_RNG` token pattern (`calibration/draw.ts`), `drawWeight`'s smoothed rate (`flash-cards/draw-weights.ts`), `confusedWith` (`glossary/glossary-search.ts`), `CalibrationHistoryService.allAnswers`, `StatsService.resetAll`'s `stats:` prefix sweep.

## Verification

- After each R step: `rm -rf node_modules/.vitest-cache && npx ng test --watch=false`. The whole suite passes, and `library-page.spec.ts` and `design-system.spec.ts` pass unchanged. The R4 red→green commit pair is the only behaviour change.
- `npx ng build` succeeds (this proves `src/testing/` is excluded from the app).
- `app.routes.spec.ts` still counts 18 routes.
- Manual check: run the app and confirm the library page renders identically before and after R3 (screenshot comparison with Playwright).
