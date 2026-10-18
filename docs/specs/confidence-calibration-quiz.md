# Spec: Confidence calibration quiz

Handoff spec for two calibration quizzes, built as a separate mini-app next to Reasoning Traps:

- **Confidence** (standard): two-choice Calibration items, confidence 50–100%.
- **Confidence: Advanced**: Four-way items (Neither / A / B / Both), confidence 0–100% in 25% steps.

Every decision here was made on the wayfinder map [Wayfinder: Confidence calibration quiz](https://github.com/bbartolome/quizzes/issues/1). Each section links the ticket that holds the full reasoning. Vocabulary follows `GLOSSARY.md` (Calibration item, Four-way item, Confidence, Confidence bucket, Calibration curve, Brier score, Skill score, Pending round, Lifetime, Overconfidence, Confident answer).

Implementation follows the repo's TDD style: a `test: … (red)` commit, then the implementation commit.

## 1. Scope

In scope: the two quizzes, their routes, round UI, draw, scoring, history, results page, home page, library card, offline behaviour, item schema with example items, authoring guidelines.

Out of scope: a generalized "quiz kinds" engine; Julia Galef's items (her format inspired this, but her item wording is under default copyright; [Galef research](https://github.com/bbartolome/quizzes/issues/2)); per-item feedback during a round; adding an offline state to Traps.

## 2. Manifest and routing

_From [How does the library route to a separate mini-app?](https://github.com/bbartolome/quizzes/issues/4) and [Advanced confidence](https://github.com/bbartolome/quizzes/issues/9)._

- `QuizManifestEntry` gains a required `kind: 'traps' | 'calibration'`. `reasoning-traps` gets `kind: 'traps'`.
- Calibration entries also need `format: 'two-way' | 'four-way'`. It selects the item shape, the round's answer control, the confidence scale, the chart axis and the score's reference points.
- Two new entries, e.g. ids `calibration` (`two-way`, `dataPath: data/quizzes/calibration/`) and `calibration-advanced` (`four-way`, `dataPath: data/quizzes/calibration-advanced/`). Quiz ids never contain a colon.
- `LibraryPage` maps the kind to a route prefix in code (`traps` → `/quiz/:id`, `calibration` → `/calibration/:id`). Routes are never stored in the JSON.
- New routes (the `app.routes.spec.ts` route count goes from 7 to 10):
  - `calibration/:id`: home
  - `calibration/:id/round`: round
  - `calibration/:id/results`: results
- The calibration mini-app has its own models, services and pages. It must not import from `src/app/features/round` or other Traps features. Shared helpers (e.g. `shuffle(items, rng)`) are either copied or moved to a shared module. Implementation picks.

## 3. Item banks

_From [Calibration item schema and content guidelines](https://github.com/bbartolome/quizzes/issues/6) and [Service worker caching](https://github.com/bbartolome/quizzes/issues/13)._

Each quiz has its own bank at `<dataPath>/items.json`. No item appears in both banks.

```jsonc
{ "version": 1, "items": [ /* … */ ] }
```

- The bank's `version` must equal its manifest entry's `version`. A build-time unit test checks this for every calibration entry.
- **An item id is never reused**, even after the item is deleted. History is re-scored by id.

### 3.1 Calibration item (two-way)

```jsonc
{
  "id": "c001",
  "prompt": "Which is farther north?",
  "options": ["Rome", "New York"],
  "correct": 0,                       // index into options
  "topic": "geography",
  "fact": "Rome lies at about 41.9°N, New York at about 40.7°N.",
  "source": { "label": "Wikipedia: Rome", "url": "https://en.wikipedia.org/wiki/Rome" }
}
```

### 3.2 Four-way item

The same fields, except `truth: [boolean, boolean]` replaces `correct` and `facts: [string, string]` (one per option) replaces `fact`. The answer key is derived from `truth`: `[false,false]` Neither, `[true,false]` A, `[false,true]` B, `[true,true]` Both.

### 3.3 Fields and phrasing

- Required: `id`, `prompt`, `options` (exactly 2), `correct` or `truth`, `topic`, `fact` or `facts`, `source` (`label` + `url`). There is no `difficulty` field.
- `topic` is exactly one of `history`, `science`, `geography`, `nature`, `culture`, `numbers`. It is used only to balance rounds. It's never shown to players, and there's no per-topic calibration.
- Two-way prompts are comparison or "which one" questions with two concrete options. No True/False items.
- Four-way prompts are predicates that can be checked against each option on its own. No comparisons.
- Options are 2–4 words, so they fit the scale's end labels on mobile.
- Option order in the bank doesn't matter, because sides are shuffled at each draw.

### 3.4 Content guidelines

Items must be:

- **Stable**: no "current" records, populations or office-holders.
- **Verifiable** from one reputable source: no disputes and no "by some measures" answers.
- **Uncertain** for a typical adult: aim for 60–80% felt confidence. No gimmes, no pure obscurity.
- **Free of trick wording.**
- **Broadly international.**

In a four-way bank, the four outcomes are roughly balanced (about 25% each).

### 3.5 Sizes

- Round: 20 items in both quizzes (`min(20, bank size)`).
- Launch banks: **480 standard** (80 per topic) and **120 Advanced** (20 per topic). The long-term Advanced target is 480.
- Authoring the full banks is its own implementation issue (slice S12). Until then, the banks are seeded with the examples below, which gives 12-item rounds.

### 3.6 Example items: standard (seed bank)

Two per topic, with correct sides mixed.

| id | topic | prompt | options (correct in **bold**) | fact | source |
|---|---|---|---|---|---|
| c001 | geography | Which is farther north? | **Rome** / New York | Rome lies at about 41.9°N, New York at about 40.7°N. | [Wikipedia: Rome](https://en.wikipedia.org/wiki/Rome) |
| c002 | geography | Which lake is larger by area? | Lake Victoria / **Lake Superior** | Superior covers about 82,100 km², Victoria about 59,900 km². | [Wikipedia: Lake Superior](https://en.wikipedia.org/wiki/Lake_Superior) |
| c003 | history | Which came first? | **Gutenberg's press** / Fall of Constantinople | Gutenberg's press dates to around 1440; Constantinople fell in 1453. | [Wikipedia: Printing press](https://en.wikipedia.org/wiki/Printing_press) |
| c004 | history | Which canal opened first? | Panama Canal / **Suez Canal** | Suez opened in 1869, Panama in 1914. | [Wikipedia: Suez Canal](https://en.wikipedia.org/wiki/Suez_Canal) |
| c005 | science | Which has more bones? | **A human hand** / A human foot | A hand with its wrist has 27 bones; a foot has 26. | [Wikipedia: Hand](https://en.wikipedia.org/wiki/Hand) |
| c006 | science | Which metal is denser? | Lead / **Gold** | Gold is about 19.3 g/cm³, lead about 11.3 g/cm³. | [Wikipedia: Gold](https://en.wikipedia.org/wiki/Gold) |
| c007 | nature | Which has more legs? | A spider / **A lobster** | Lobsters are decapods with ten legs; spiders have eight. | [Wikipedia: Lobster](https://en.wikipedia.org/wiki/Lobster) |
| c008 | nature | Which has more adult teeth? | **A dog** / A human | Adult dogs have 42 teeth; adult humans have 32. | [Wikipedia: Dog anatomy](https://en.wikipedia.org/wiki/Dog_anatomy) |
| c009 | culture | Which was written first? | **Hamlet** / Don Quixote | Hamlet dates to about 1599–1601; Don Quixote Part One was published in 1605. | [Wikipedia: Hamlet](https://en.wikipedia.org/wiki/Hamlet) |
| c010 | culture | Which premiered first? | Beethoven's Ninth / **The Barber of Seville** | Rossini's opera premiered in 1816; Beethoven's Ninth in 1824. | [Wikipedia: The Barber of Seville](https://en.wikipedia.org/wiki/The_Barber_of_Seville) |
| c011 | numbers | Which is larger? | 10³ / **2¹⁰** | 2¹⁰ = 1,024; 10³ = 1,000. | [Wikipedia: Power of two](https://en.wikipedia.org/wiki/Power_of_two) |
| c012 | numbers | Which is larger? | 7 × 8 × 9 / **23²** | 23² = 529; 7 × 8 × 9 = 504. | Arithmetic ([Wikipedia: Square number](https://en.wikipedia.org/wiki/Square_number)) |

### 3.7 Example items: Advanced (seed bank)

Two per topic, three of each outcome.

| id | topic | prompt | options | truth | key | facts | source |
|---|---|---|---|---|---|---|---|
| a001 | nature | Which of these is a mammal? | Platypus / Penguin | [T, F] | A | The platypus is an egg-laying mammal. · Penguins are birds. | [Wikipedia: Platypus](https://en.wikipedia.org/wiki/Platypus) |
| a002 | geography | Which of these borders Brazil? | Chile / Ecuador | [F, F] | Neither | Chile and Ecuador are the only South American countries that don't border Brazil. (Same fact for both.) | [Wikipedia: Borders of Brazil](https://en.wikipedia.org/wiki/Borders_of_Brazil) |
| a003 | numbers | Which of these is prime? | 91 / 97 | [F, T] | B | 91 = 7 × 13. · 97 is prime. | [Wikipedia: List of prime numbers](https://en.wikipedia.org/wiki/List_of_prime_numbers) |
| a004 | science | Which of these planets has rings? | Neptune / Uranus | [T, T] | Both | Neptune has a faint ring system. · Uranus has 13 known rings. | [Wikipedia: Rings of Neptune](https://en.wikipedia.org/wiki/Rings_of_Neptune) |
| a005 | history | Which of these people was born before 1900? | Albert Einstein / Frida Kahlo | [T, F] | A | Einstein was born in 1879. · Kahlo was born in 1907. | [Wikipedia: Albert Einstein](https://en.wikipedia.org/wiki/Albert_Einstein) |
| a006 | science | Which of these is a noble gas? | Nitrogen / Argon | [F, T] | B | Nitrogen is in group 15. · Argon is a group 18 noble gas. | [Wikipedia: Noble gas](https://en.wikipedia.org/wiki/Noble_gas) |
| a007 | geography | Which of these cities is a national capital? | Istanbul / Zurich | [F, F] | Neither | Turkey's capital is Ankara. · Switzerland's federal city is Bern. | [Wikipedia: Ankara](https://en.wikipedia.org/wiki/Ankara) |
| a008 | culture | Which of these is a national language of Switzerland? | Romansh / Italian | [T, T] | Both | Switzerland's four national languages are German, French, Italian and Romansh. (Same fact for both.) | [Wikipedia: Languages of Switzerland](https://en.wikipedia.org/wiki/Languages_of_Switzerland) |
| a009 | history | Which of these opened before 1900? | Eiffel Tower / Brooklyn Bridge | [T, T] | Both | The Eiffel Tower opened in 1889. · The Brooklyn Bridge opened in 1883. | [Wikipedia: Eiffel Tower](https://en.wikipedia.org/wiki/Eiffel_Tower) |
| a010 | culture | Which of these was written by Leo Tolstoy? | War and Peace / Crime and Punishment | [T, F] | A | Tolstoy wrote War and Peace. · Dostoevsky wrote Crime and Punishment. | [Wikipedia: War and Peace](https://en.wikipedia.org/wiki/War_and_Peace) |
| a011 | nature | Which of these is native to Australia? | Kiwi / Wombat | [F, T] | B | Kiwis are native to New Zealand. · Wombats are native to Australia. | [Wikipedia: Wombat](https://en.wikipedia.org/wiki/Wombat) |
| a012 | numbers | Which of these is divisible by 7? | 143 / 187 | [F, F] | Neither | 143 = 11 × 13. · 187 = 11 × 17. | Arithmetic ([Wikipedia: Divisibility rule](https://en.wikipedia.org/wiki/Divisibility_rule)) |

## 4. Drawing a round

_From [How is a calibration round drawn from the bank?](https://github.com/bbartolome/quizzes/issues/10)._

`drawRound(bank, log, rng)` is a pure function with an injected `rng`.

1. **Size**: `min(20, bank size)`.
2. **Topic quotas**: 3 slots per topic, plus a 4th slot for two topics picked at random (3 × 6 + 2 = 20). A bank under 20 items is drawn whole, so quotas don't apply (as with the 12-item seed banks).
3. **Fill.** An item is _seen_ if its id appears in the submitted log.
   1. Fill each topic's quota with that topic's unseen items, chosen uniformly at random.
   2. **Freshness beats balance**: if a topic runs short, fill its empty slots with unseen items from other topics, at random.
   3. Only when the whole bank has fewer unseen items than the round needs, fill what's left with seen items, **least recently answered first** (by `submittedAt`), breaking ties at random. Take repeats from topics whose quotas are still unfilled where possible.
   4. Once every item has been seen, this gives a second pass, oldest first. There's no cycle counter.
4. **Sides**: each item's sides are swapped on an independent 50/50 flip. On a four-way item this swaps A and B, and Neither and Both stay as they are. Then the whole round is shuffled, so topics are mixed.
5. Items and sides are frozen into the pending round.
6. Repeated items are scored and counted like any other item.

## 5. Round UI

_From [What does answering a calibration item feel like?](https://github.com/bbartolome/quizzes/issues/5), [Advanced confidence](https://github.com/bbartolome/quizzes/issues/9) and this spec's gap review._

### 5.1 Shared round shell (both quizzes)

- One item per screen, showing the prompt.
- Progress dots, one per item, showing which items are answered. Tapping a dot opens that item. There's also a back control.
- Committing an answer moves on to the next item. A revisited item shows its current answer selected, and a new answer replaces it.
- Answers can be changed until the round is submitted. The round never ends automatically. A **Submit round** button is enabled once every item is answered. Submitting fixes the answers and goes to `/results`.
- No correctness is shown before submit.
- Every pick is saved to the pending round (§7.4) straight away.

### 5.2 Standard answer control

A single 11-stop bipolar scale:

`<A> 100 · 90 · 80 · 70 · 60 · 50 · 60 · 70 · 80 · 90 · 100 <B>`

One tap records both the choice and the confidence. The 50 stop is one shared "no idea" stop. A 50 answer is stored with the pick set to the left on-screen side, mapped back to bank order. At 50% the side doesn't affect the score.

### 5.3 Advanced answer control

Two steps on one screen:

1. Pick one of **Neither / <A> / <B> / Both**. The confidence row appears.
2. Tap **0 · 25 · 50 · 75 · 100%**. This records the answer and moves to the next item. There's no Next button.

A revisited item shows both selections. Changing the choice clears the confidence until a new one is tapped. The item counts as answered only when both are set.

## 6. Scoring

_From [How should calibration be scored and displayed?](https://github.com/bbartolome/quizzes/issues/3), [Advanced confidence](https://github.com/bbartolome/quizzes/issues/9), [Brier explanation](https://github.com/bbartolome/quizzes/issues/12) and [Results report](https://github.com/bbartolome/quizzes/issues/7)._

All of these are pure functions.

| | standard (two-way) | Advanced (four-way) |
|---|---|---|
| confidence stops (= buckets) | 50, 60, 70, 80, 90, 100 | 0, 25, 50, 75, 100 |
| chance rate | 50 | 25 |
| guessing Brier | 0.25 | 0.1875 |
| chart x-axis | 50–100 | 0–100 |
| Confident answer | 90, 100 | 75, 100 |

- **Correct**: two-way, `pick === correct`. Four-way, `pick` (`[bool, bool]` in bank order) equals `truth`.
- **Brier per answer**, with c = confidence / 100: `(1 − c)²` if correct, `c²` if wrong. A set's Brier is the mean (0–1 scale).
- **Skill score** = `chance + (100 − chance) × (1 − Brier / guessingBrier)`, rounded to a whole number. Not clamped: it can go below 0.
  - Standard reference values: calibrated at 70% → 58, at 80% → 68, at 90% → 82. Says 100% but right 70% of the time → 40; right half the time → 0.
- **Overconfidence** = mean confidence − % correct, in points. Within ±2 it reads "well calibrated", otherwise "N points overconfident" or "N points underconfident".
- **Bucket stats**: for each stop, `n`, hits, % correct and a **Wilson 95% interval**. An empty bucket has no point.
- **Flags**: a miss at 100% (both quizzes). A 0% answer on Advanced is _below chance_.

## 7. History and persistence

_From [Calibration history model](https://github.com/bbartolome/quizzes/issues/8) and [Service worker caching](https://github.com/bbartolome/quizzes/issues/13)._

### 7.1 Storage

One record per quiz under `stats:calibration:<quizId>` in localStorage. The existing `StatsService.resetAll` clears every `stats:` key, so **Reset all progress** clears calibration history with no change. These keys can't collide with Traps' `stats:<quizId>` because quiz ids contain no colon.

### 7.2 Answer log

An append-only list of submitted rounds:

```ts
interface CalibrationRound {
  submittedAt: string;          // ISO timestamp
  bankVersion: number;          // the loaded bank's own version
  answers: CalibrationAnswer[];
}
interface CalibrationAnswer {
  itemId: string;
  pick: number | [boolean, boolean]; // two-way: option index in bank order; four-way: bank order
  confidence: number;                // the stop value
  correct: boolean;
}
```

`pick` is always in bank order, never the shuffled on-screen side.

### 7.3 Summary

`{ roundsPlayed, brierSum, answerCount }` is stored next to the log. The library card reads it without loading a bank: lifetime Brier is `brierSum / answerCount`, and the Skill score is computed from that.

### 7.4 Pending round

- One per quiz: the drawn item ids, their sides, the picks so far and `bankVersion`. It's saved on every pick, and a changed answer overwrites the earlier one.
- It doesn't count toward the lifetime record, rounds played or the score until submitted.
- It never expires. The home button reads **Resume round** while a round is pending, and a small **Start over** discards it. Going to `/round` directly resumes it, or draws a new round if none is pending.

### 7.5 Round vs lifetime

- Results show **this round** against the **lifetime before it**. On the first round, the "before" side is an empty state.
- Refreshing `/results` shows the most recently submitted round again. Going to `/results` with no submitted round redirects to the calibration home.
- The home page and the library card use every submitted round.

### 7.6 Bank changes (migration)

- **The version that counts is the loaded bank's own `version`, never the manifest's.** The manifest `version` is only the library's cheap check for "has this bank changed?", used to decide which banks to fetch.
- When the loaded bank's version differs from the history's `bankVersion`:
  - The whole log is re-scored against the bank by item id, so corrected answer keys also fix old answers.
  - Answers whose item ids no longer exist are deleted, and so is any round left empty.
  - `roundsPlayed` never goes down.
  - The summary is rebuilt, and the history is stamped with the bank's version.
  - A pending round whose `bankVersion` doesn't match is discarded.
- If the loaded bank's version is **lower than the manifest's**, the bank is a stale cache. Use it as it is, but don't migrate or stamp anything. The real migration runs once the fresh bank arrives.
- Migration runs on every calibration page load, and also on library load for banks whose manifest version differs from the stored one.
- Deleted answers no longer count as seen for the draw.

## 8. Results page (`calibration/:id/results`)

_From [Calibration results report](https://github.com/bbartolome/quizzes/issues/7), [Chart rendering](https://github.com/bbartolome/quizzes/issues/11) and [Brier explanation](https://github.com/bbartolome/quizzes/issues/12)._

Top to bottom:

1. **Calibration chart** (§10). Shows the lifetime before this round, filled: points, Wilson bars and `n` under each x-tick. This round is drawn on top as hollow markers on a dashed line, offset slightly. On the first round, the chart shows the round alone with its own Wilson bars, plus a note: one round is too few answers to say much, and the chart becomes the lifetime curve as rounds are added.
2. **Score cards**, side by side:
   - **Skill score**: this round's value on a 0–100 gradient bar, with ticks at the chance rate ("guessing") and 100 ("perfect"). The zone below the chance tick is lighter and labelled _worse than guessing_. The true value is always shown as text, and the marker pins at 0 below that. Under it: "Before this round: N" with a ▲/▼ delta, hidden on the first round. Small print: `Brier 0.14` (2 decimals).
     - Help line, always visible: "Guessing scores 50, perfect scores 100. Rewards both knowing the answers and judging your confidence." Advanced says 25.
     - **"How is this scored?"** disclosure, the only place the formula appears: per answer, (1 − confidence)² if right and confidence² if wrong; the average is the Brier score, and lower is better. Then the Skill score formula with this quiz's chance rate and guessing Brier, and a worked example: 80% and right = 0.04.
   - **Confidence vs. accuracy**: this round's Overconfidence in words, with mean confidence and % correct, and the lifetime-before phrase under it. This is the calibration-only number. The Skill score mixes in knowledge.
3. **Item review**, in four groups and this order, hiding any empty group:
   1. **Confident misses** (open by default)
   2. **Hedged misses** (open)
   3. **Underplayed hits** (collapsed)
   4. **Confident hits** (collapsed)

   Each row shows the confidence, the prompt, the player's pick, the correct answer on a miss, and the `fact` (or `facts` on four-way items) with its source link. Tags: _Miss at 100%_; _Below chance_ on Advanced 0% answers.

## 9. Home page (`calibration/:id`)

- Title and description from the manifest.
- **Start round**, which reads **Resume round** while a round is pending, plus **Start over** when pending (§7.4).
- **Lifetime sparkline** (§10.3). Before the first round it's hidden, replaced by "Play a round to start your calibration curve".
- Lifetime Skill score and rounds played (implementation may reuse the results card's visuals).
- **Repeats note**: when fewer unseen items remain than the next round needs, one quiet line: "You've seen every item. Some will repeat." Nothing is shown during the round.
- **Bank unavailable**: if the bank can't load (e.g. offline and never cached), the home and round pages show "Couldn't load this quiz. Check your connection and try again." with a **Retry** button. Traps is unchanged.

## 10. Calibration chart

_From [Hand-rolled SVG or a chart library for the calibration curve?](https://github.com/bbartolome/quizzes/issues/11) and [Scoring and display research](https://github.com/bbartolome/quizzes/issues/3)._

Hand-rolled SVG with no chart library, so the bundle and the PWA are unaffected.

### 10.1 Geometry core

A pure function maps (axis: two-way 50–100 or four-way 0–100, bucket stats, optional overlay stats) to geometry: points, Wilson bars, line segments that break at empty buckets, the diagonal, the chance line, shaded regions and flag rings.

Chart rules: a 45° diagonal for perfect calibration; shaded, labelled halves (below = overconfident, above = underconfident); a chance line; accuracy (y) always 0–100%; every x-tick kept; no point for an empty bucket and no line across a gap.

### 10.2 Results chart

The full chart from §8. Text alternative: `role="img"` with an aria-label, plus a visible **"Show as table"** toggle, collapsed by default. The table lists bucket, n, % correct, Wilson range, and this round's hits/n.

### 10.3 Home sparkline

A separate, minimal component: lifetime points and the diagonal only. No bars, n, shading or round overlay. Same gap rules. aria-label "Lifetime calibration curve". No table.

## 11. Library

_From [Library routing](https://github.com/bbartolome/quizzes/issues/4) and [Brier explanation](https://github.com/bbartolome/quizzes/issues/12)._

- Calibration cards link to `/calibration/:id`.
- A calibration card shows **rounds played** and **"Skill score N"** (lifetime), with the Skill score hidden before the first round. No raw Brier and no anchors.
- Calibration rounds **add to** the header's "rounds played across all" total but **don't count** toward its "overall accuracy".
- Reset all progress clears calibration history through the `stats:` prefix (§7.1). Add a test for it.

## 12. PWA

_From [How should the service worker cache calibration banks?](https://github.com/bbartolome/quizzes/issues/13)._

No `ngsw-config.json` change. The existing `quiz-data` data group (`data/quizzes/**/*.json`, freshness, 30d, 3s timeout) covers the banks. Banks are cached lazily when first opened, with no prefetch. A never-opened bank shows the bank-unavailable state (§9) offline.

## 13. Proposed implementation slices

TDD-sized, in dependency order. Each is a red commit followed by the implementation commit. These are proposals; turning them into issues is a separate step.

| # | Slice | Covers | Depends on |
|---|---|---|---|
| S1 | Manifest `kind`/`format` and library routing: model fields, `reasoning-traps` gets `kind: 'traps'`, two calibration entries, card links by kind, three placeholder routes, route spec updated | §2, §11 links | — |
| S2 | Bank model and loading: types, `{version, items}` loader, seed banks with the §3.6 and §3.7 examples, build-time version test, bank-unavailable state with Retry | §3, §9 offline, §12 | S1 |
| S3 | Scoring core (pure): correctness, Brier, Skill score, Overconfidence, buckets with Wilson, confident classification, flags, per-format constants | §6 | — |
| S4 | Draw (pure): quotas, freshness, oldest-seen repeats, side flips, shuffle, `min(20, bank)` | §4 | S2 types |
| S5 | History service: log, summary, pending round save/resume/discard, submit, seen set, migration (bank's own version, stale-cache rule) | §7 | S2, S3 |
| S6 | Standard round page: shell (dots, back, change answers, Submit), bipolar scale, resume and draw on entry | §5.1, §5.2 | S4, S5 |
| S7 | Advanced round page: two-step control in the shared shell | §5.3 | S6 |
| S8 | Chart geometry core plus results chart with "Show as table" | §10.1, §10.2 | S3 |
| S9 | Results page: chart with lifetime-before and round overlay, first-round state, Skill score card with help and disclosure, Confidence vs. accuracy card, four-group review with tags, refresh and redirect behaviour | §8, §7.5 | S5, S8 |
| S10 | Calibration home: start/resume/start over, lifetime sparkline or prompt, lifetime stats, repeats note | §9, §10.3 | S5, S8 |
| S11 | Library card stats: rounds played, lifetime Skill score, header totals, reset-all test | §11 | S1, S3, S5 |
| S12 | Author the full banks: 480 standard (80 per topic) and 120 Advanced (20 per topic, balanced outcomes), following §3.3–§3.4, then bump the version. Content work rather than TDD; the S2 version test guards it | §3.5 | S2 |
