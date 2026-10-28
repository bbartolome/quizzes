# Spec: Biases & Fallacies flash cards

Handoff spec for two flash card quizzes, **Biases** and **Fallacies**, listed in the library next to Reasoning Traps. Each one drills one deck of the shared knowledge base with scored, multiple-choice cards in all three card directions.

Every decision here was made on the wayfinder map [Wayfinder: Biases & Fallacies flash cards](https://github.com/bbartolome/quizzes/issues/15). Each section links the ticket that holds the full reasoning. Vocabulary follows `GLOSSARY.md` (Flash card quiz, Knowledge base, Deck, Target, Card direction, Lure, Spotting tip, Confused pair, Pair tip, Draw weight).

Implementation follows the repo's TDD style: a `test: … (red)` commit, then the implementation commit.

## 1. Scope

In scope: moving and reshaping the knowledge base (with Reasoning Traps switching over), the two manifest entries and their routes, card building, draw weights, the round feed, the report page, the home page, and the Stats page reuse.

Out of scope:

- Writing new knowledge-base entries or new tips. Expansion is designed for, not done.
- Self-graded flip cards. Cards are multiple choice and scored.
- Reasoning Traps reading flash card counts (for Weak spots or anything else). The flow is one-way ([What do flash card results store, and do they feed back into Reasoning Traps?](https://github.com/bbartolome/quizzes/issues/21)).
- Storing results per card direction or per (target, lure) mistake.

## 2. Knowledge base

_From [How do the flash card quizzes plug into the library and routes?](https://github.com/bbartolome/quizzes/issues/16) and [How are distinguishing tips modelled so the knowledge base can grow?](https://github.com/bbartolome/quizzes/issues/18)._

### 2.1 Location

- The file moves from `public/data/quizzes/reasoning-traps/knowledge-base.json` to `public/data/concepts/knowledge-base.json`.
- It loads from that one fixed app-level path (e.g. `QuizDataService.loadKnowledgeBase()`), never from a manifest `dataPath`. Reasoning Traps' bundle gets its knowledge base from there, and `dataPath` keeps only per-quiz files (`questions.json`, `templates.json`).
- `ngsw-config.json`: the `quiz-data` dataGroup gains `data/concepts/**/*.json`.

### 2.2 Shape

```jsonc
{
  "concepts": [
    {
      "id": "anchoring",
      "name": "Anchoring",
      "type": "bias", // 'bias' | 'fallacy'
      "shortDefinition": "…",
      "longExplanation": "…",
      "example": "…",
      "spottingTip": "…", // optional
    },
  ],
  "pairs": [
    { "concepts": ["anchoring", "hasty-generalization"], "tip": "…" }, // tip optional
  ],
}
```

- `commonlyConfusedWith` and `distinguishingTip` are removed from entries. A concept's confused partners are derived from `pairs`.
- A **confused pair** is unordered and may join a bias and a fallacy. Its optional **pair tip** belongs to the pair and names both sides.
- A pair with no tip still drives lures, the side-by-side fallback and the in-round pair bump.
- The knowledge base has no `version` of its own (§3.3).

### 2.3 Migration (no new text written)

| Entry or pair                                        | Spotting tip                      | Pair tip                                  |
| ---------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| The 6 entries in today's 3 mirrored pairs            | First sentence of the current tip | —                                         |
| {survivorship-bias, base-rate-neglect}               | —                                 | survivorship-bias's current tip, verbatim |
| {anchoring, hasty-generalization}                    | —                                 | anchoring's current tip, verbatim         |
| {straw-man, false-dilemma}                           | —                                 | straw-man's current tip, verbatim         |
| availability-heuristic                               | First sentence of its current tip | —                                         |
| New pair {availability-heuristic, base-rate-neglect} | —                                 | availability-heuristic's full current tip |
| The other 9 entries                                  | Current tip, unchanged            | —                                         |

Result: 16 concepts (7 biases, 9 fallacies) and 4 pairs, all with tips. The mirrored text from the other side of each existing pair is dropped.

### 2.4 Authoring guard

A spec test over the JSON rejects: a pair with an unknown concept id, a self-pair, and duplicate pairs in either order. It also checks that concept ids are unique.

### 2.5 Reasoning Traps switches over

In the same slice as the move, with no adapter:

- **Round page, option ⓘ panel** ("Tip:"): the concept's spotting tip. Hidden when it has none.
- **Round page feedback and report**: `findConfusionTips(options, kb)` returns the pair tip for each confused pair whose two concepts both appear among the question's options, in option order. Pairs without a tip are skipped.
- **Glossary page**: the selected concept's spotting tip after its example, then one block per confused partner with the pair tip (when there is one) and the existing "Quiz me on this pair" link. `confusedWith` derives partners from `pairs`.
- `reasoning-traps` bumps its manifest `version` from 1 to 2 (the rule in §3.3).

## 3. Manifest and routing

_From [How do the flash card quizzes plug into the library and routes?](https://github.com/bbartolome/quizzes/issues/16) and [What does the end of a flash card round show, and where?](https://github.com/bbartolome/quizzes/issues/22)._

### 3.1 Manifest

- `QuizManifestEntry.kind` becomes `'traps' | 'calibration' | 'biases' | 'fallacies'`.
- `dataPath` becomes optional. The flash card entries leave it out. Traps and calibration entries keep theirs.
- No `conceptType` field: the concept type comes from the route (§3.2).
- Two new entries:

| id          | title     | kind        | version | order |
| ----------- | --------- | ----------- | ------- | ----- |
| `biases`    | Biases    | `biases`    | 1       | 1     |
| `fallacies` | Fallacies | `fallacies` | 1       | 2     |

The existing entries move down: Reasoning Traps 3, Confidence 4, Confidence: Advanced 5. Descriptions, `icon` (`icons/biases.svg`, `icons/fallacies.svg`, following the existing convention) are picked at implementation; they're easy to change.

### 3.2 Routes

Both kinds share their pages. Each route carries `data: { conceptType: 'bias' | 'fallacy' }`.

| Path                            | Page                 | Added in |
| ------------------------------- | -------------------- | -------- |
| `biases/:id`, `fallacies/:id`   | Flash card home      | S2       |
| `biases/:id/round`, `…/round`   | Flash card round     | S2       |
| `biases/:id/report`, `…/report` | Flash card report    | S7       |
| `biases/:id/stats`, `…/stats`   | `StatsPage` (reused) | S9       |

`app.routes.spec.ts` goes from 10 routes to 14 (S2), then 18 (S7 and S9).

- `LibraryPage.routeFor` becomes a kind → prefix map (`traps` → `/quiz`, `calibration` → `/calibration`, `biases` → `/biases`, `fallacies` → `/fallacies`). Today's two-way ternary would send a new kind to `/calibration/`.
- The flash card pages live in `src/app/features/flash-cards/` and are shared by both kinds. They may use `core/` (models, `QuizDataService`, `StatsService`) and must not import from Reasoning Traps' `features/round` or `features/report`. A shared helper such as `shuffle` is copied or moved to a shared module; implementation picks.

### 3.3 Versioning

- The knowledge base has no version. Any edit to it (concepts or pairs) bumps the `version` of every entry that reads it: Reasoning Traps, Biases and Fallacies. This keeps `migrateVersion(id, version, kbIds)` working as it does today. Record this as an authoring guideline next to the knowledge base (e.g. a short `README.md` in `public/data/concepts/`).
- The flash card round page calls `StatsService.migrateVersion(<kind id>, entry.version, <deck concept ids>)` on load, like Reasoning Traps.

## 4. Card building

_From [What does answering a flash card feel like?](https://github.com/bbartolome/quizzes/issues/17) and [What does learning research say about drilling easily confused concepts?](https://github.com/bbartolome/quizzes/issues/19)._

A pure function builds one card from the knowledge base, the target and an injected RNG.

### 4.1 Card direction

Picked independently for each card, each with probability 1/3. That puts the two → term directions together at 2:1 over term → definition.

| Direction         | Legend (bias / fallacy)                                      | Prompt                         | Options are             |
| ----------------- | ------------------------------------------------------------ | ------------------------------ | ----------------------- |
| definition → term | "Which bias is this?" / "Which fallacy is this?"             | target's `shortDefinition`     | names                   |
| example → term    | "Which bias does this example show?" / "…fallacy…"           | target's `example`, in italics | names                   |
| term → definition | "What does this bias mean?" / "What does this fallacy mean?" | target's `name`, in bold       | `shortDefinition` texts |

The prompt sits in a shaded box under the legend.

### 4.2 Options and lures

- Always 4 options, single-select (radio buttons): the target and 3 lures.
- Lures come first from the target's confused partners (any pair containing the target), in a random order, up to 3.
- The remaining slots are filled at random from **both decks**, excluding the target and lures already picked. A Biases card can offer a fallacy and the other way round.
- The 4 options are shuffled.

## 5. Draw weights and targets

_From [Which Reasoning Traps results personalize flash cards, and how?](https://github.com/bbartolome/quizzes/issues/20), [What do flash card results store, and do they feed back into Reasoning Traps?](https://github.com/bbartolome/quizzes/issues/21) and the map's charting session._

A pure function picks each card's target from the kind's deck.

- **Pooled counts.** For each deck concept, `correct` and `attempted` are its `perTrait` counts in `stats:reasoning-traps` plus those in `stats:<kind>`, read when the round starts. A concept missing from both counts as 0 / 0.
- **Draw weight** = `1 + 2 × (1 − p)`, with `p = (correct + 0.5) / (attempted + 1)`. It runs from 1 (mastered) to 3 (always missed). 0 / 0 gives 2, so a player with no history at all gets a uniform draw.
- **Always on and silent.** No Weak spots mode, no banner. Reasoning Traps' `weakTraitWeights` stays as it is.
- **No back-to-back repeat.** The target is drawn, weighted, from the deck minus the previous card's target. Otherwise a concept can come up any number of times in a round.
- **In-round pair bump.** When a card is answered with a wrong pick that is a confused partner of the target, that lure's draw weight goes up by 1 for the rest of the round, capped at 3. A lure from the other deck can't be a target in this round, so its bump has no effect. Bumps are not stored.
- Weights computed at round start aren't recomputed after each card; only the pair bump changes them during a round.

## 6. Round page (`<kind>/:id/round`)

_From [What does answering a flash card feel like?](https://github.com/bbartolome/quizzes/issues/17) and [What does the end of a flash card round show, and where?](https://github.com/bbartolome/quizzes/issues/22)._

### 6.1 Feed

- The Reasoning Traps feed: cards stack in a scrolling list, one fieldset per card. The newest card scrolls into view.
- **Check answer** is enabled once an option is picked. Checking locks the card, shows its feedback and appends the next card below.
- The round is endless: there's always a next card. It ends only with **End quiz**.
- The sticky footer shows the score ("N of M correct") and **End quiz**.

### 6.2 Feedback after Check answer

- Options are labelled **Correct answer** and **Your pick** (on a wrong pick).
- The feedback block shows, in order:
  1. **Correct** or **Incorrect**.
  2. "Answer: <target name>".
  3. The target's `longExplanation`, then its spotting tip if it has one.
  4. The contrast:
     - **Wrong pick, pair tip exists** for {target, lure}: "<target> vs <lure>: <pair tip>".
     - **Wrong pick, no pair tip** (the pair has no tip, or the lure isn't a confused partner): the lure's name and `shortDefinition`, plus the lure's spotting tip if it has one, so both concepts can be read side by side.
     - **Correct**: the tip of the first confused pair (in option order) whose partner was among the options. If no partner was an option, the first of the target's pairs that has a tip. If neither exists, nothing.

### 6.3 Recording

- Each checked card calls `StatsService.recordResult('<kind id>', …)` with the target as the only trait: one attempt for the target, correct only if the target was picked. Lures get no counts. `streak` updates as in Reasoning Traps.
- Nothing is written to `stats:reasoning-traps`.
- **End quiz** calls `recordSessionEnd` only if at least one card was checked, then navigates to `<kind>/:id/report` with the round's results in `history.state` (per checked card: target, picked option's concept, correct).

## 7. Report page (`<kind>/:id/report`)

_From [What does the end of a flash card round show, and where?](https://github.com/bbartolome/quizzes/issues/22)._

A new page shared by both kinds. Reasoning Traps' `ReportPage` is not reused.

- Summary line: "N of M correct".
- **Missed this round**: one line per wrong card, "<target> — you picked <lure>". A repeated (target, lure) pair appears once, in first-miss order. A perfect round shows a short "No misses" note instead.
- No tips or explanations are repeated.
- Actions: **Next round** (primary, to `<kind>/:id/round`) and **Back to Biases** / **Back to Fallacies** (to the home page).
- **Empty state**: with no results (zero cards checked, or a reload that lost `history.state`), it shows a short message and a link back to the home page.

## 8. Home page (`<kind>/:id`)

_Settled while assembling this spec ([Assemble the flash card handoff spec and its slice order](https://github.com/bbartolome/quizzes/issues/23))._

- Title and description from the manifest entry.
- **Start round** (primary, to `<kind>/:id/round`).
- Progress from `stats:<kind>`: rounds played and accuracy (hidden or "—" before the first answer).
- A link to the Stats page (`<kind>/:id/stats`).
- A read-only list of the deck's concepts, each with its name and `shortDefinition`. No filters and no concept picker.
- A back link to the library.

## 9. Stats page reuse (`<kind>/:id/stats`)

_From [What does the end of a flash card round show, and where?](https://github.com/bbartolome/quizzes/issues/22)._

`StatsPage` is reused for both kinds, configured through route data:

- It reads only `stats:<kind>`, not the pooled counts the draw uses.
- Concept names come from the knowledge base loaded from the fixed path (§2.1), so it works for entries with no `dataPath`.
- The rows heading reads "Performance by concept" (Reasoning Traps keeps "Performance by trait").
- The "Start a round focused on your weakest traits" link is hidden, since draw weights already favour weak concepts.
- **Reset progress for this quiz** clears only `stats:<kind>`.

## 10. Library

_From [How do the flash card quizzes plug into the library and routes?](https://github.com/bbartolome/quizzes/issues/16)._

- Order: Biases, Fallacies, Reasoning Traps, Confidence, Confidence: Advanced.
- Each flash card card shows rounds played and accuracy from its `stats:<kind>` record, the same way the Reasoning Traps card does (`QuizCard.kind` widens to the new kinds).
- Both count toward the header's rounds total and overall accuracy, and toward "most recently played".
- **Reset all progress** clears them (it clears every `stats:` key already).

## 11. Proposed implementation slices

TDD-sized, in dependency order. Each is a red commit followed by the implementation commit. These are proposals; turning them into issues is a separate step.

| #   | Slice                                                                                                                                                                                                                                                                                                     | Covers          | Depends on |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------- |
| S1  | Knowledge base move and reshape: `data/concepts/knowledge-base.json` as `{ concepts, pairs }` with the §2.3 migration, fixed-path loader, authoring guard test, ngsw glob, Reasoning Traps round ⓘ panel / `findConfusionTips` / glossary switched over, `reasoning-traps` version 2, authoring guideline | §2, §3.3        | —          |
| S2  | Manifest kinds and library routing: `kind` union, optional `dataPath`, Biases and Fallacies entries, new order, `routeFor` map, library card stats and totals for the new kinds, placeholder home and round pages on four routes with `conceptType` data (10 → 14 routes)                                 | §3.1, §3.2, §10 | —          |
| S3  | Card building (pure): direction pick, legend and prompt, 4 options with confused partners first and the rest from both decks, shuffle, injected RNG                                                                                                                                                       | §4              | S1         |
| S4  | Feedback contrast (pure): spotting tip, pair tip or side-by-side fallback for a wrong pick, the correct-answer rule                                                                                                                                                                                       | §6.2            | S1         |
| S5  | Draw weights and targets (pure): pooled counts from two `QuizStats`, the weight formula, weighted pick excluding the previous target, in-round pair bump with cap                                                                                                                                         | §5              | S1         |
| S6  | Round page: feed, Check answer, feedback block, score footer, `migrateVersion`, per-card recording to `stats:<kind>`, End quiz with `history.state`                                                                                                                                                       | §6              | S2–S5      |
| S7  | Report page: summary, deduplicated Missed this round list, No misses note, Next round / Back actions, empty state; `report` routes (→ 16)                                                                                                                                                                 | §7              | S6         |
| S8  | Home page: title, description, Start round, progress, deck list, Stats link, back link (replaces the S2 placeholder)                                                                                                                                                                                      | §8              | S1, S2     |
| S9  | Stats page reuse: `stats` routes (→ 18), knowledge base from the fixed path, concept heading, weak-traits link hidden, per-kind reset                                                                                                                                                                     | §9              | S1, S2     |

S1 and S2 are independent and can run in parallel. S3–S5 are independent of each other. S7, S8 and S9 can be done in any order once their dependencies land; the route count in `app.routes.spec.ts` ends at 18 either way.
