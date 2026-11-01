# Spec: Practice layer (app-wide gamification)

Handoff spec for one gamification layer that spans every quiz in the library: a **Practice streak** with **Rest days**, **Mastery** for every concept, a **Today panel** on the library page, and informational **Badges**. Reasoning Traps, Biases, Fallacies, the three Confidence quizzes and the planned game-theory hub all feed it through one recorder.

This spec comes from a codebase audit and a literature review, not from a wayfinder map. Where a decision is the author's default rather than a settled one, it is listed in §13. Vocabulary follows `GLOSSARY.md` (Practice layer section). The game-theory hub plugs into this layer through `docs/specs/game-theory.md`; the easier-quizzes work is in `docs/specs/easier-quizzes.md`.

Implementation follows the repo's TDD style: a `test: … (Pn, red)` commit, then the implementation commit.

## 1. Scope

In scope: a recorder service, the streak and rest-day rules, concept mastery for Reasoning Traps, Biases and Fallacies (and the hook game theory uses), the Today panel, a true "most recently played", four cross-quiz badges and the badge registry, and the reset behaviour.

Out of scope:

- Leaderboards, XP, levels, leagues, currency, cosmetics, notifications and any social comparison.
- Backfilling a streak for existing players. They start at zero.
- Accounts, sync or a backend. Clearing browser data loses the streak.
- The game-theory daily puzzle and the eight game-theory badges. They are specified in `game-theory.md` and register into this layer.
- Changing how any quiz scores, draws or stores its own results.

## 2. What the audit found

- **Only calibration stores a timestamp.** `CalibrationRound.submittedAt` (UTC ISO, `calibration.models.ts:61`) is the only one in the app. Traps and flash cards store counts only. A local-day key must come from local getters (`dateKeyOf`), never `toISOString().slice(0, 10)`.
- **Calibration history can't back a streak.** `migrate()` drops rounds left empty by a bank change, and `resetQuiz` and `resetAll` erase the log. The streak needs its own store.
- **"Most recently played" is not time-based.** `LibraryPage.summary$` (`library-page.ts:87-94`) picks the card with the highest answer streak, ties broken by rounds played.
- **"Streak" already means consecutive correct answers.** `QuizStats.streak` shows as "Current streak" (`library-page.html`). The new concept is the **Practice streak**; the old one is named **Answer streak** in the glossary.
- **Concept mastery needs no new answer recorder.** Per-concept `correct` and `attempted` already live in `stats:reasoning-traps`, `stats:biases` and `stats:fallacies`, keyed by the same knowledge-base ids. `pooledCounts` (`flash-cards/draw-weights.ts`) already pools two of them.
- **Reasoning Traps stores a pseudo-trait.** Questions q17, q18, q23, q24 and q30 are tagged `sound-reasoning`, which is not a knowledge-base id. `recordResult` stores it, and the next `RoundPage` load deletes it through `migrateVersion`. Mastery must ignore ids that are not in the knowledge base.
- **The recorder cannot live inside `StatsService`.** `stats.service.spec.ts` constructs it with `new` in 25 places, and `CalibrationHistoryService` is constructed directly in its spec. Adding an `inject()` to either constructor breaks those specs, and game theory would bypass both services anyway.

## 3. The recorder

A root-provided **`PracticeService`** in `src/app/core/services/practice.service.ts`, called right after each existing record call.

| Quiz                   | Call site                                                                         | Passed                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Reasoning Traps        | `features/round/round-page.ts:182`, after `stats.recordResult`                    | `conceptIds`: the question's `traitIds` that are knowledge-base ids; `count: 1` |
| Biases, Fallacies      | `features/flash-cards/flash-card-round-page.ts:194`, after `stats.recordResult`   | `conceptIds: [target.id]`, `count: 1`                                           |
| Confidence (all three) | `features/calibration/calibration-round-page.ts:173`, after `history.submit(...)` | `count: <submitted round>.answers.length`, no concepts                          |
| Game theory            | `GtEvidenceService` (`game-theory.md` G9)                                         | `conceptIds`, `count: 1`                                                        |

```ts
export interface AttemptInput {
  conceptIds?: readonly string[];
  count?: number; // scored answers this call stands for; default 1
}
export interface PracticeSnapshot {
  enabled: boolean;
  streak: number; // effective streak (§4.3)
  longest: number;
  restDays: number;
  practicedToday: boolean;
  attemptsToday: number;
}
class PracticeService {
  recordAttempt(quizId: string, input: AttemptInput, now?: Date): PracticeSnapshot;
  recordDaily(now?: Date): PracticeSnapshot; // the game-theory daily puzzle was answered
  snapshot(now?: Date): PracticeSnapshot;
  setEnabled(enabled: boolean): void;
}
```

- `now` defaults to the `APP_CLOCK` token (`InjectionToken<() => Date>`, default `() => new Date()`), so specs inject dates.
- `recordAttempt` stamps `lastPlayedAt[quizId]`, adds `count` to today's attempts, increments each unique concept's practice-day count once per local day, and applies the streak when the day first qualifies (§4.1).
- The recorder reads `globalThis.localStorage` at call time, so it works under both `localStorage.clear()` specs and `vi.stubGlobal('localStorage', new MemoryStorage())` specs.
- A per-tap calibration save (`CalibrationHistoryService.record`, which calls `savePending`) is **not** a scored attempt and must not call the recorder.

> **Amendment (prefactor R2, `docs/specs/practice-layer-prefactor.md`):** the service also exposes `lastPlayed()`, `conceptDays()`, `badges()`, `recordBadges(earned, now?)` and `saveFailed: Signal<boolean>`. Consumer lanes read through the service and never touch storage.

## 4. Practice day, streak and rest days

### 4.1 Practice day

A **practice day** is a local calendar date on which the player has either:

- at least **5 scored answers** across any quizzes (one submitted Confidence round of 10 or 20 answers qualifies on its own), or
- answered the game-theory daily puzzle (`recordDaily`).

Wrong answers count: the streak measures effort, not correctness. Reading a tutorial, using a hint, free-play bot turns and tournament runs do not count (`game-theory.md` §9 says which game-theory events call the recorder).

Every quiz counts equally. The audit found no evidence for or against one streak shared across several modes. The risk is drifting to the easiest quiz, so the Today panel shows an informational "this week" line of the quizzes played (§7). It is not required to keep the streak.

### 4.2 Rest days

Called **Rest days** in the UI (freezes in code):

- The player starts with 1 and holds at most 2.
- One is granted every 7 calendar days while below the cap. This is time-based, not performance-based.
- One is spent automatically, and lazily, per missed day when the player next qualifies. There is no button, no purchase and no shame copy: "A rest day covered yesterday."

State: `restDays` plus `nextRestDayOn: DateKey | null`, which is `null` exactly when `restDays` is at the cap.

### 4.3 Pure functions

`src/app/core/utils/practice-streak.ts` and `dates.ts`. No Angular, no `Date.now`, no no-argument `new Date()`.

```ts
export type DateKey = string; // 'YYYY-MM-DD', local calendar date
export function dateKeyOf(d: Date): DateKey; // local getters, never toISOString
export function dayNumber(key: DateKey): number; // Date.UTC(y, m - 1, d) / 86_400_000
export function addDays(key: DateKey, n: number): DateKey;

export interface StreakState {
  current: number;
  longest: number;
  lastPracticeDate: DateKey | null;
  restDays: number;
  nextRestDayOn: DateKey | null;
  covered: DateKey[]; // last 10 dates a rest day covered, informational
}
export const REST_DAY_CAP = 2;
export function initialStreak(firstPractice: DateKey): StreakState; // restDays 1
export function refillRestDays(s: StreakState, today: DateKey): StreakState;
export function applyPracticeDay(s: StreakState, today: DateKey): StreakState;
export function effectiveStreak(s: StreakState, today: DateKey): number;
```

`applyPracticeDay` first calls `refillRestDays`. Then, with `gap = dayNumber(today) − dayNumber(lastPracticeDate)`:

| `gap`                       | Result                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `lastPracticeDate` is null  | `current = 1`, `longest = max(longest, 1)`                                                        |
| `≤ 0`                       | No change. Covers a second qualification the same day, a clock set backwards and timezone repeats |
| `1`                         | `current + 1`                                                                                     |
| `> 1`, `gap − 1 ≤ restDays` | Spend `gap − 1` rest days, record the covered dates, `current + 1`                                |
| `> 1`, `gap − 1 > restDays` | `current = 1`. No rest days are spent                                                             |

`longest` is never reduced. Spending a rest day while at the cap sets `nextRestDayOn = today + 7`.

`effectiveStreak` is what the UI shows, so a dead streak never displays as alive: `current` when `gap ≤ 1`, or when `gap − 1 ≤ restDays` after a refill as of `today`; otherwise 0.

### 4.4 Edge cases the tests must cover

First-ever practice. Second qualification on the same date (idempotent). Clock set backwards. A `lastPracticeDate` in the future (treated as clock skew, no change). Midnight rollover mid-session: the clock is read at each attempt, and `today.attempts` resets when the date changes. Daylight-saving transitions (dates are strings and arithmetic goes through `Date.UTC`). Travelling east skips a date, which a rest day covers or the streak resets; travelling west repeats one, which is a no-op. A multi-day gap that rest days partly cover. Rest-day refill after a long absence, capped at 2. Refill while at the cap does nothing.

## 5. State and persistence

One key: **`stats:app:practice`**.

- It sits inside the `stats:` prefix, so **Reset all progress** clears it (`StatsService.resetAll` removes every `stats:` key).
- `StatsService.resetQuiz(id)` does not touch it, so resetting one quiz doesn't wipe the player's streak.
- Quiz ids never contain a colon, so the key can't collide with `stats:<quizId>`.

```ts
interface PracticeState {
  version: 1;
  enabled: boolean; // "Hide streak and badges"
  streak: StreakState;
  today: { date: DateKey; attempts: number; dailyDone: boolean };
  lastPlayedAt: Record<string, string>; // quiz id -> ISO instant
  conceptDays: Record<string, { days: number; lastDay: DateKey }>;
  badges: Record<string, { earnedAt: string; evidence: string }>;
}
```

- Reads never throw. Every field is type-guarded with a default, so a bad field is replaced on the next write. An unknown or future `version` is treated as corrupt and returned zeroed, and is not persisted until the next mutation.
- Writes are wrapped in try/catch, because quota or private mode can fail. On failure the library shows "Progress can't be saved in this browser."
- `enabled` defaults to `true`. When `false`, the streak, rest days and badges are hidden everywhere. The recorder keeps recording, so turning it back on loses nothing.
- Size is well under 10 KB: `conceptDays` is bounded by the number of concepts, `badges` by the registry, `covered` by 10.
- **No backfill.** Calibration's `submittedAt` could seed days, but Traps and flash cards have counts only, so a backfill would be inconsistent between quizzes.

## 6. Concept mastery

Pure, in `src/app/core/utils/mastery.ts` and `concept-counts.ts`. They import nothing from `features/`.

```ts
export type MasteryState = 'new' | 'learning' | 'practised' | 'mastered';
export interface ConceptEvidence {
  attempted: number;
  correct: number;
  days: number; // distinct practice days
  challengeAttempts?: number; // game theory only
  requiresChallenge?: boolean; // the concept has a generated mode
}
export function masteryOf(e: ConceptEvidence): MasteryState;
export function pooledConceptCounts(
  records: readonly QuizStats[],
  validIds: ReadonlySet<string>,
): Map<string, { attempted: number; correct: number }>;
```

With the same smoothed rate as `drawWeight`, `p = (correct + 0.5) / (attempted + 1)`:

| State     | Rule                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------- |
| New       | `attempted = 0`                                                                                 |
| Learning  | `attempted ≥ 1`                                                                                 |
| Practised | `attempted ≥ 4` and `p ≥ 0.60`                                                                  |
| Mastered  | `attempted ≥ 8`, `p ≥ 0.80`, `days ≥ 2`, and, when `requiresChallenge`, `challengeAttempts ≥ 3` |

- 7 of 8 correct gives `p = 0.833` (mastered). 6 of 8 gives `0.722` (not).
- Mastery is **evaluated on read**, so it can demote when accuracy falls.
- The two-day clause is the spacing: a single cram session can't master a concept. The challenge clause stops card memorisation counting as mastery of a concept that also has puzzles.
- **Legacy counts:** a concept with `attempted > 0` and no `conceptDays` entry counts as 1 day, so existing players aren't penalised.
- `pooledConceptCounts` ignores any id not in `validIds` (this drops `sound-reasoning`) and sums the three records per concept. It does not replace `pooledCounts` in `draw-weights.ts`.
- Mastery is computed on library, stats and hub load, **never per answer**: `flash-card-round-page.spec.ts` asserts `getStats('reasoning-traps')` is called exactly once.

Surfaces on the existing quizzes:

- The Stats pages (`stats-page.html`) show a state glyph and its word for each concept: ○ New, ◔ Learning, ◑ Practised, ● Mastered. Colour is never the only signal.
- Library cards show "Concepts practised N / M" (Practised or Mastered): Biases N / 7, Fallacies N / 9, Reasoning Traps N / 16.

## 7. Today panel and library

A panel above the quiz collections in `library-page.html`, inside the existing `space-y-8` container. It shows:

- **Practice streak** and **Rest days**, hidden when `enabled` is false. A zero effective streak shows "Practise today to start a streak" instead of "0".
- **Suggested today:** a link to the quiz played least recently, from `lastPlayedAt`. A quiz with no entry counts as never played and is suggested first.
- **This week:** the quizzes played in the last 7 local days, as a plain text line. Informational.
- Later, the game-theory daily puzzle status ("Daily puzzle: open" or "done"), added by `game-theory.md` G27.
- A **Hide streak and badges** toggle.

Changes to the existing header:

- "Most recently played" uses `lastPlayedAt` (latest wins). Cards with no entry fall back to the old streak-and-rounds heuristic, so existing players still see something.
- The **Reset all progress** confirmation (`library-page.ts:113`) also mentions the practice streak.
- Each card keeps its own numbers (Accuracy and Answer streak, or Skill score). Calibration rounds keep counting toward rounds played but not overall accuracy (`confidence-calibration-quiz.md` §11).

## 8. Badges

Informational, never summed, never revoked. No confetti, no total counter, no completion ring.

```ts
export interface BadgeContext {
  mastery: ReadonlyMap<string, MasteryState>;
  pairs: readonly ConfusedPair[];
  calibration: ReadonlyArray<{ confidence: number; correct: boolean }>; // lifetime, all three quizzes
  extra: Readonly<Record<string, unknown>>; // game-theory evidence, §game-theory.md G28
}
export interface BadgeDef {
  id: string;
  title: string; // "Knows what it knows"
  insight: string; // "Your confident answers are right more often than your guesses."
  criterion: string; // shown while unearned, as "Can you show…?"
  earned(ctx: BadgeContext): boolean;
}
export function earnedBadges(defs: readonly BadgeDef[], ctx: BadgeContext): string[];
```

Evaluated lazily (library load, results screens), never per answer. Once earned, `badges[id]` is stored with `earnedAt` and a one-line `evidence`.

Four cross-quiz badges ship here; game theory registers eight more (`game-theory.md` §9).

| Badge                 | Shows the player…                             | Criterion                                                                                                                                                |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notices-lookalikes`  | told confusable concepts apart                | Both concepts of any confused pair are Practised                                                                                                         |
| `names-the-trap`      | can name what they spot                       | At least 8 of the 16 knowledge-base concepts are Practised                                                                                               |
| `knows-what-it-knows` | separates what they know from what they don't | Over at least 30 lifetime Confidence answers, with at least 8 in each group, the hit rate at confidence ≥ 80% beats the hit rate at ≤ 60% by ≥ 20 points |
| `sure-means-sure`     | trusts their high confidence for good reason  | At least 20 answers at confidence ≥ 90%, with a hit rate ≥ 85%                                                                                           |

Presentation: a quiet line on the relevant results screen ("You showed that your confident answers are right more often than your guesses"), plus an **Insights** list on the library page. The list shows earned badges and, below them, each unearned criterion as "Can you show…?". Four-way answers use `confidence ≥ 75%` as high and `≤ 25%` as low for the two `knows-what-it-knows` groups, matching their confident-stop definition.

> **Amendment (prefactor R2):** each `BadgeContext.calibration` entry carries `format: CalibrationFormat`. The four-way thresholds (≥75% / ≤25%) differ from the two-way ones, and `{ confidence, correct }` alone can't tell the formats apart. `CalibrationFormat` is declared in `core/models/quiz.models.ts` and re-exported from `features/calibration/calibration.models.ts`.

## 9. Evidence and guardrails

The layer is built to avoid the known ways extrinsic rewards backfire:

- No tangible or performance-contingent rewards. Deci, Koestner and Ryan (1999, 128 studies) found tangible rewards undermined intrinsic motivation (d ≈ −0.28 for performance-contingent, −0.36 completion-contingent, −0.40 engagement-contingent), while positive informational feedback raised it (d ≈ +0.33).
- The streak counts **practice, not score**. Wrong answers still count.
- Rest days are **non-contingent**: they refill on a timer, not for performance. Evidence on slack in goals and on the effect of a single missed day is moderate and secondhand; Duolingo's own freeze figures (+0.38% daily active users) are company-reported, so treat them as direction, not size.
- Badges are verbal competence feedback tied to a named insight, not a quantity to collect. One residual risk: listed criteria are expected symbolic rewards. The hide toggle, and never totalling or ranking badges, mitigate it.
- No leaderboards or social comparison (a small study found a leaderboard-and-badges course lowered motivation; the source is secondary).
- Gamification effects are modest in the literature (g ≈ .49 cognitive, .36 motivational, .25 behavioural). Nothing in the UI claims that the layer improves learning.
- The streak is shown only while `effectiveStreak > 0` and `enabled`.

## 10. Test impact

These existing specs constrain the slices. Each must be handled in the slice that touches the related code.

1. `flash-card-round-page.spec.ts` (`:144-150`, `:230-238`) asserts `getStats('reasoning-traps')` is called exactly once. The recorder must not call `StatsService.getStats` from the answer path.
2. `round-page.spec.ts` (`:63-68`, `:113-119`) replaces `StatsService` with a four-method mock (`migrateVersion`, `getWeakTraits`, `recordResult`, `recordSessionEnd`). The recorder must not use `StatsService` for anything else.
3. The Traps round spec does not stub `localStorage`; add a stub or `clear()`. Flash-card specs use `localStorage.clear()` (`:82`); calibration specs use `MemoryStorage` through `vi.stubGlobal`.
4. **Existing bug, fixed in P3:** `calibration-round-page.ts:168-175` `submit()` never clears `this.pending`, so a double tap before navigation appends the round twice. Guard it (a `submitted` flag, or clear `pending`) with a test, because a count-based recorder would double-count.
5. `library-page.spec.ts:389-395` queries `section a h3` and expects exactly the quiz card headings. The Today panel must not contain an `a` inside an `h3` inside a `section`, or that test is scoped.
6. `app.routes.spec.ts` stays at 18 routes: this spec adds none.
7. `design-system.spec.ts` now has no allowlist, so every new template (Today panel, Insights list, mastery glyphs) must be token-clean from its first commit.

## 11. Design-system compliance

- Token utilities and `type-*` roles only. State is a glyph plus a word, never colour alone (`ui-status`, `OUTCOME_LOOK`).
- The Today panel uses `uiCard` and `type-*` roles, with `data-testid`s on its controls. The toggle is a native checkbox with a visible label.
- Nothing animates, auto-advances or shows a count-up.

## 12. Proposed implementation slices

TDD-sized, in dependency order. Each is a red commit followed by the implementation commit.

| #   | Slice                                                                                                                                                                      | Covers  | Depends on |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| P1  | Pure `dates.ts` (`DateKey`, `dateKeyOf`, `dayNumber`, `addDays`) and `practice-streak.ts` (initial, refill, apply, effective) with every §4.4 edge case; `APP_CLOCK` token | §4      | —          |
| P2  | `PracticeService` and `PracticeState`: safe read and write, corruption and version tests, reset-all clears it, `resetQuiz` leaves it, `enabled` toggle                     | §3, §5  | P1         |
| P3  | Wire the three call sites; update the touched specs (§10 items 1–3); fix the calibration double-submit                                                                     | §3, §10 | P2         |
| P4  | Pure `masteryOf` and `pooledConceptCounts` (ignores non-knowledge-base ids, legacy-day rule)                                                                               | §6      | —          |
| P5  | Today panel on the library page; "Most recently played" from `lastPlayedAt`; reset confirmation text                                                                       | §7      | P2, P3     |
| P6  | Mastery glyph and word on the Stats pages; "Concepts practised N / M" on library cards                                                                                     | §6      | P3, P4     |
| P7  | Badge registry and `earnedBadges`, persistence in `PracticeState`, the four cross-quiz badges, Insights list, results-screen line                                          | §8      | P2, P4, P6 |
| P8  | Final library polish: header totals review, hide-toggle copy, empty states                                                                                                 | §7      | P5, P6, P7 |

P1 and P4 are independent and can start immediately. P5, P6 and P7 can run in any order once their dependencies land.

## 13. Defaults and open questions

Author defaults, change before building:

1. Every quiz counts equally toward one Practice streak. A weekly mix requirement is not enforced.
2. The threshold is 5 scored answers per day.
3. Rest days: start 1, cap 2, one more every 7 days.
4. The layer is on by default, with a hide toggle.
5. The streak starts at zero for existing players.
6. The Today panel's "Suggested today" is the least recently played quiz, not a weak-spot recommendation.
7. `stats:app:practice` is wiped by Reset all progress, which also loses badges. If you would rather keep badges across resets, they need their own key outside `stats:`.

Sources:

- Deci, Koestner and Ryan 1999, _Psychological Bulletin_ 125: https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf
- Sailer and Homner 2020, _Educational Psychology Review_ (gamification meta-analysis): https://link.springer.com/article/10.1007/s10648-019-09498-w
- Duolingo streak design, company-reported figures (no sample sizes): https://blog.duolingo.com/how-duolingo-streak-builds-habit
- Hanus and Fox 2015 (leaderboards and badges), seen only through a secondary summary: https://flipeducation.ai/teaching-wiki/gamification
