# Spec: Easier quizzes

Handoff spec for making the existing quizzes approachable to an average person without removing what makes them useful: a new **Confidence: Basic** quiz with easier questions and shorter rounds, plain-language copy and results on all three Confidence quizzes, an easier start for Reasoning Traps, and first-run hints on the three concept quizzes.

This spec comes from a codebase audit and a literature review, not from a wayfinder map. Where a decision is the author's default rather than a settled one, it is listed in §10. Vocabulary follows `GLOSSARY.md` (Easier quizzes section). The streak, mastery and badges that sit on top of these quizzes are in `docs/specs/practice-layer.md`.

Implementation follows the repo's TDD style: a `test: … (En, red)` commit, then the implementation commit. The design-system slices S1–S11 have landed, so `design-system.spec.ts` has no allowlist: every template touched here must be token-clean.

## 1. Scope

In scope: a third calibration bank (Basic) with an item `level`, round size per manifest entry, copy and results changes across the three Confidence quizzes, an easy start for Reasoning Traps, and copy and first-run hints for Reasoning Traps, Biases and Fallacies.

Out of scope:

- Replacing, retiring or re-scoring the existing Confidence and Confidence: Advanced quizzes, or touching their histories.
- Tagging the existing 480 and 120 items with a `level` (a possible later slice, §10).
- A new answer control. A three-level Guess / Think so / Sure control is designed for but not built (slice E10).
- Per-item feedback during a calibration round, and partial credit in Reasoning Traps.
- Gentler flash cards (same-deck lures, three options, dropping a card direction). They contradict `flash-cards.md` §4 and were not selected.

## 2. Why calibration feels too hard

The problem is first the **questions**, then the screen around them.

### 2.1 The items

A sample of 36 of the 480 items (6 per topic; a reviewer's impression, not a measurement) found a handful a typical adult could answer and many that read as guesses. Examples:

| Item   | Pair                                   | Why it is hard              |
| ------ | -------------------------------------- | --------------------------- |
| `c190` | Callisto vs Titan, larger moon         | Specialist astronomy        |
| `c323` | Great Slave vs Great Bear, larger lake | Specialist geography        |
| `c363` | Hagia Sophia vs the Pantheon, older    | Needs a precise date        |
| `c124` | Papyrus vs Bamboo, the true grass      | Botanical definition        |
| `c430` | Aye-aye vs Mongoose, the primate       | Obscure animals             |
| `c237` | Rashomon vs Seven Samurai, first       | Film history                |
| `c057` | Collatz steps, 97 vs 27                | Not answerable by intuition |
| `c011` | `10³` vs `2¹⁰`                         | Mental arithmetic           |

- All 80 `numbers` items are "Which is larger?" mental-arithmetic comparisons.
- The schema has no difficulty field (`confidence-calibration-quiz.md` §3.3), and §3.4 asks only that items be "uncertain for a typical adult".

### 2.2 Why it matters for the goal

The quiz exists to make players aware of how sure they are. That needs a mix of things they know and things they don't.

- On hard sets, accuracy drifts toward chance, so any confidence above a guess then looks like overconfidence. The **hard–easy effect** (overconfidence on hard items, underconfidence on easy ones) is well documented, though part of it is argued to be a statistical artefact of how items are selected (Juslin, Winman and Olsson 2000). Evidence strength: moderate.
- Overconfidence appeared for hard, selected items and largely vanished for randomly sampled ones (Gigerenzer, Hoffrage and Kleinbölting 1991; Soll 1996 found harder sets still produce more). Evidence strength: moderate, seen through secondary summaries.
- Design consequence (an inference, not a finding): mix easy, medium and hard items, aim for roughly 65–75% overall accuracy, and avoid items so hard that every answer is a coin flip. That lets a player compare how right their "sure" answers are against their guesses.

### 2.3 The screen around the items

Found by the audit, and the same lay-user problem:

- The 11 scale stops are bare numbers (`100 90 80 70 60 50 60 70 80 90 100`, `bipolar-scale.ts:9`, `:20`). The only words are in `aria-label`s. Nothing visible says "how sure are you".
- The eyebrow prints the raw manifest string `two-way` or `four-way` (`calibration-round-page.html:7`).
- Four-way confidence is a 0–100% row whose only label is `aria-label="Confidence"` (`four-way-control.ts:22`).
- Results lead with a chart and `Brier 0.14` (`skill-score-card.html:5`).
- Feedback arrives only after about 20 taps, at the end of a round. That is a design decision of the calibration spec (§1, §5.1) and stays.

## 3. Confidence: Basic

A new calibration quiz with easier items and 10-item rounds. It reuses the two-way answer control, scale, chart and scoring unchanged, so the `CalibrationFormat` union is not widened.

### 3.1 Manifest entry

```jsonc
{
  "id": "calibration-basic",
  "title": "Confidence: Basic",
  "description": "Pick an answer and say how sure you are. Easier questions and shorter rounds.",
  "icon": "icons/calibration-basic.svg",
  "version": 1,
  "dataPath": "data/quizzes/calibration-basic/",
  "order": 4,
  "kind": "calibration",
  "format": "two-way",
  "roundSize": 10,
}
```

- `QuizManifestEntry` gains an optional `roundSize?: number` (calibration entries only; default 20).
- Existing entries move down: `calibration` to order 5, `calibration-advanced` to 6. Their ids, versions and histories are untouched. Titles are unchanged.
- The entry has its own `dataPath` and bank, so it keeps `confidence-calibration-quiz.md` §3's rule that each quiz has its own bank. It also gets its own history, seen-item set and pending round (`stats:calibration:calibration-basic`) and avoids two entries sharing one `dataPath`.
- No route changes: `/calibration/:id/*` is generic and `app.routes.spec.ts` stays at 18.
- The bank `version` must equal the manifest `version` (build-time test), as for the other banks.

### 3.2 Item schema

Two-way items gain an optional field:

```ts
export type ItemLevel = 1 | 2 | 3;
export interface TwoWayItem {
  /* …existing fields… */
  level?: ItemLevel; // absent in the existing banks
}
```

A bank with no `level` behaves exactly as today (§3.4). **The level is never shown to the player**, like `topic`.

| Level | A typical adult is right (authoring target, unmeasured) | Per 10-item round |
| ----- | ------------------------------------------------------- | ----------------- |
| 1     | about 90%                                               | 4                 |
| 2     | about 70%                                               | 4                 |
| 3     | about 55–60%                                            | 2                 |

Expected round accuracy is about 75%. For other round sizes the mix is 40% / 40% / 20%, rounded by largest remainder.

### 3.3 Draw

`ROUND_SIZE = 20` (`draw.ts:18`) becomes the default. `drawRound`, `quotasFor` and `unseenCount` take a size, and `home-stats.ts:34` reads it from the entry.

- **Topic quotas** generalise the current rule (3 per topic plus 2 extras at size 20): `base = floor(size / 6)` per topic, and `size mod 6` random extra topics. At size 10 that is 1 per topic plus 4 extras.
- **Level quotas** are a second dimension. After the topic quotas are set, a shuffled multiset of levels is assigned to the slots, and each slot takes an unseen item of its topic and level. If none exists it takes an unseen item of the nearest level in that topic, then falls back through the existing steps 2 and 3 (any unseen item, then seen items least recently answered first).
- **No levels, no change.** For a bank whose items have no `level`, the sequence of rng calls and the result are identical to today's. A test pins this, using the existing draw specs unchanged.
- Each branch documents its rng draw order, as `buildCard` does.

### 3.4 Content (about 180 items)

- 30 per topic over the six existing topics: 12 level 1, 12 level 2, 6 level 3.
- Ids `b001`–`b180`, disjoint from the existing `c###` ids. Ids are never reused.
- Same fields as a two-way item (§3.1 of the calibration spec): prompt, two options of 2–4 words, `correct`, `topic`, `fact`, `source`, plus `level`.
- The `numbers` topic becomes easy numeric comparisons (fractions, powers of ten, round-number estimates), not mental arithmetic.
- Level 1 means common knowledge a typical adult gets right most of the time. Illustrative, unchecked examples: "Which is larger? 1/2 vs 1/3" (level 1); "Which came first? The printing press vs the telephone" (level 2); "Which country is larger by area? Spain vs Sweden" (level 3). Every real item is verified (below).
- **Authoring.** Drafting with a model is allowed. Before merge, a person checks every `fact` and `source` against the cited page, because a guard test can only check shape. Each item's level comes from a quick review: two reviewers rate "would a typical adult get this right?", the level is set from their ratings, and an item they rate two levels apart is dropped.
- Authoring rules live in `public/data/quizzes/calibration-basic/README.md`.

### 3.5 Guards

A spec test over the JSON imports (the `bank-version.spec.ts` pattern) checks that:

- ids are unique and disjoint from every other bank's ids, and `topic` is one of the six topics;
- every item has a `level` of 1, 2 or 3;
- each topic has at least 10 level-1, 10 level-2 and 4 level-3 items (enough for a full round without a fallback);
- options are 2–4 words, and `fact` and `source.url` are present;
- the bank `version` equals the manifest `version`.

`bank-version.spec.ts` already passes for a two-way entry: its format allow-list and its `if (format === 'two-way') … else` branch need no change, and the "shares no item id between banks" test passes with disjoint ids.

### 3.6 Library

The Basic quiz reuses the Confidence card (`calibrationCardStats`, Skill score) unchanged.

## 4. Calibration copy and results (all three Confidence quizzes)

### 4.1 The round

- A visible line under the prompt: "How sure are you? 100 means certain, 50 means a coin flip." For the four-way quiz: "How sure are you? 100 means certain, 0 means certain you're wrong." Wording is picked at implementation.
- The 11 stops show `%`, with visible "Guess" at the centre and "Certain" at the ends (`bipolar-scale.ts`). The `aria-label`s stay.
- The four-way confidence row gets a visible label (`four-way-control.ts:22`).
- The eyebrow shows a plain label instead of the manifest string (for example "Pick one" for two-way and "Judge each option" for four-way), not `e.format`.

### 4.2 The results

New order: a **lead card**, **frequency lines**, the **Skill score** card, the **item review**, and a **Details** disclosure.

1. **Lead card.** The existing "Confidence vs. accuracy" card moves first, with a sentence: "You said you were about 78% sure on average, and you were right 71% of the time."
2. **Frequency lines.** Natural frequencies for three confidence groups, from the buckets `buildResultsView` already produces (`n`, `hits`, `pct`):

   | Quiz           | High  | Medium | Low   |
   | -------------- | ----- | ------ | ----- |
   | Two-way (both) | ≥ 90% | 70–80% | ≤ 60% |
   | Four-way       | ≥ 75% | 50%    | ≤ 25% |

   Each line reads "At 90% or more: 5 of 6 right", for this round and, beside it, "so far: 41 of 52". Natural frequencies are used because lay people read them far more accurately than probabilities (Gigerenzer and Hoffrage 1995). Applying that to calibration feedback is an inference.

3. **Verdict only on lifetime figures.** A 10-item round has about 3 answers per group, which is too noisy for a verdict. When a group has at least 10 lifetime answers, show one sentence comparing its hit rate to the group's midpoint (95 / 75 / 55 for two-way; 87 / 50 / 12 for four-way): within 10 points reads "about right", below reads "lower than your confidence", above reads "higher than your confidence".
4. **Skill score** card stays visible (it is the number on the library card), but its always-visible `Brier 0.14` caption (`skill-score-card.html:5`) moves into the existing "How is this scored?" disclosure. `skill-score-card.spec.ts:44` asserts the Brier format and is updated.
5. **Details** (collapsed): the calibration curve, its "Show as table", and the 95% range. The chart appears once there are about 30 lifetime answers; before that, Details shows the existing "too few answers" sentence.

`confidence-calibration-quiz.md` §6 and §8 (chart first, Brier in small print) are amended accordingly.

### 4.3 First-run explainer (Basic home)

While the Basic history is empty, its home page shows one explainer above **Start round**: a mock item, the three groups, and "Sure should be right about 9 times in 10". "First run" is derived from the empty log, so there is no new storage. Once a round is submitted the explainer is replaced by the usual home content.

## 5. Reasoning Traps easy start

A new player's first answers are easier, and the option list is shorter.

- **Which questions.** Easy mode draws from the 13 fixed questions with `difficulty: 1` (the split is 13 / 11 / 6). The field exists on every question and is never read today (`quiz.models.ts:25`). Template questions (about 25% of draws) already show 4 options and stay in the mix.
- **Which options.** The correct answers plus distractors, 5 options at most, instead of all 17 checkboxes. Distractors are the correct answers' confused-pair partners first, then random knowledge-base concepts, shuffled with the correct ones. "No trap — sound reasoning" is always included on questions where it is correct, and is otherwise an ordinary distractor candidate. Scoring is unchanged: exact-set against `correctAnswers`, which are always among the options.
- **When.** Easy mode is on while `roundsPlayed === 0` for the quiz and fewer than 8 questions have been answered in the round. It ends early once at least 4 are answered and accuracy is at least 70%. After that, the full 17-option list and all difficulties return. There is no setting.
- **Where.** A pure `trimOptions(question, kb, rng)` and an `easy` flag in `nextQuestion` (`round-builder.ts:118`); `parseRoundFilters` (`:10`) is unchanged. The page only passes the flag. `round-page.html` already renders `entry.question.options`, so the template needs no structural change.
- **Caveat to handle.** `nextQuestion` ends the round when the fixed-question pool is exhausted even though templates remain. Easy mode filters the fixed pool to 13 and uses at most 8, so it cannot exhaust it, and a test pins that.
- **Cost, accepted:** with fewer options per question, a new player meets fewer confused-pair tips early. They return once easy mode ends.

## 6. Copy and first-run hints

For Reasoning Traps, Biases and Fallacies. First-run is derived from empty stats (`roundsPlayed === 0` and no attempts), so no new storage. The hints fade once the player has answered a few items.

- **Instruction line** above the Traps options: "Pick every trap that applies. Usually it is one." The legend today is only the prompt (`round-page.html:5-7`).
- **Plain labels.** "Traits" (`quiz-home-page.html:46`) and "Performance by trait" (`stats-page.html:28`) become "Concepts" and "Performance by concept". `GLOSSARY.md` already lists "trait" as a term to avoid. Code names, the `weakTraits` query parameter and the stats keys stay as they are, so URLs and storage don't change. Specs that assert the old headings are updated.
- **Definitions.** The flash-card home (`flash-card-home-page.html`) opens with one plain sentence: a bias is a habit of thinking that pushes judgment off course; a fallacy is a flaw in how an argument is built. The manifest descriptions for Biases and Fallacies are rewritten in plain language.
- **ⓘ hint.** Option definitions exist for 16 of the 17 options (`round-page.html:28-50`) and nothing says so. While first-run hints are active, show "Tap ⓘ on an option to see what it means."
- Each hint is a `ui-callout` or a `type-caption` line. None is modal.

## 7. Spec amendments

| Document                         | Section        | Change                                                                                                |
| -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `confidence-calibration-quiz.md` | §2             | Add `roundSize`; a two-way entry may have its own bank and `level`                                    |
| `confidence-calibration-quiz.md` | §3             | Add the Basic bank; item `level`                                                                      |
| `confidence-calibration-quiz.md` | §3.4           | "Uncertain for a typical adult" applies to the Confidence and Advanced banks; Basic targets about 75% |
| `confidence-calibration-quiz.md` | §3.5, §4       | Round size per entry; level quotas                                                                    |
| `confidence-calibration-quiz.md` | §6, §8         | Results order (§4.2 above); Brier in the disclosure                                                   |
| `confidence-calibration-quiz.md` | §7             | History per quiz id, unchanged; note the third quiz                                                   |
| `GLOSSARY.md`                    | Easier quizzes | Add **Basic quiz**, **Item level**, **Easy start** and **First-run hint**                             |

## 8. Sources

- Hard–easy effect and its artefact critique: https://en.wikipedia.org/wiki/Hard%E2%80%93easy_effect (secondary).
- Item selection and overconfidence (Gigerenzer et al. 1991; Soll 1996), seen through a secondary summary: https://ideas.repec.org/a/cup/judgdm/v6y2011i1p43-57_4.html
- Natural frequencies (Gigerenzer and Hoffrage 1995): https://pmc.ncbi.nlm.nih.gov/articles/PMC4604268
- Certainty-based marking with three levels, for the three-level control in E10: https://docs.moodle.org/404/en/Using_certainty-based_marking
- Worked examples and training wheels for first-run help: https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/worked-and-faded-examples and https://www.nngroup.com/articles/training-wheels-user-interface/

Gaps: no study of how lay people read calibration plots was found, none compares per-item with end-of-round calibration feedback, and no human study says how many confidence levels people use meaningfully. The `75%` accuracy target and the 40/40/20 level mix are design targets, not findings.

## 9. Proposed implementation slices

TDD-sized, in dependency order. Each is a red commit followed by the implementation commit.

| #   | Slice                                                                                                                                                               | Covers   | Depends on |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| E1  | Round size parameter: `drawRound`, `quotasFor`, `unseenCount` and `home-stats.ts` take a size (default 20); `QuizManifestEntry.roundSize`; existing specs unchanged | §3.3     | —          |
| E2  | Item `level` in the schema and level-aware quotas, with the "no levels, no change" pin                                                                              | §3.2–3.3 | E1         |
| E3  | Basic bank (about 180 items), `README.md`, content guards, the verification and difficulty-review pass                                                              | §3.4–3.5 | E2         |
| E4  | Manifest entry `calibration-basic` and order shifts, `GLOSSARY.md` terms, calibration spec amendments                                                               | §3.1, §7 | E1, E3     |
| E5  | Round copy: visible explainer line, `%` and Guess / Certain labels, plain eyebrow, four-way label                                                                   | §4.1     | —          |
| E6  | Plain-language results: lead card, frequency lines with lifetime figures and verdicts, Brier into the disclosure, chart and table under Details                     | §4.2     | —          |
| E7  | Basic first-run explainer on its home page                                                                                                                          | §4.3     | E4         |
| E8  | Reasoning Traps easy start: difficulty-1 first, `trimOptions`, graduation rule, exhaustion test                                                                     | §5       | —          |
| E9  | Copy and first-run hints for Traps, Biases and Fallacies                                                                                                            | §6       | —          |
| E10 | _(not selected, cut candidate)_ Three-level Guess / Think so / Sure control, scored 50 / 70 / 90, as a third `format`                                               | §1       | E4         |

E1–E4 touch no templates. E5, E6, E8 and E9 are independent of each other and of E1–E4. E3 is the long pole: about 180 items to write, source and review.

## 10. Defaults and open questions

Author defaults, change before building:

1. The fix is easier content, not a new control. E10 stays a cut candidate because the research supports three levels (certainty-based marking uses three) but it was not selected.
2. Basic's rounds are 10 items, not 20. A single round cannot support a stable curve, so Basic leans on lifetime figures.
3. Items are 40% easy, 40% medium, 20% hard, aiming for about 75% accuracy. Real adult accuracy per level is unmeasured; the app has no backend to measure it.
4. The existing 480 and 120 item banks are not re-levelled. Tagging them (bank version bump, history re-scored by id) would let the standard quiz mix easy items too.
5. Library order is Biases, Fallacies, Reasoning Traps, Confidence: Basic, Confidence, Confidence: Advanced (then Game Theory).
6. Traps easy mode applies only to a player's first round.
7. The Skill score card stays visible on the results screen; only its Brier caption, the chart and the table move.
