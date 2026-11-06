# Spec: Game theory

Handoff spec for a **Game Theory** hub in the library that teaches game theory through play: flash cards, payoff-matrix puzzles, repeated Prisoner's Dilemma against named bots, a beauty contest, and auctions, introduced by tutorials and tracked by the shared practice layer.

This spec comes from a codebase audit and a literature review, not from a wayfinder map. Where a decision is the author's default rather than a settled one, it is listed in §14. Vocabulary follows `GLOSSARY.md` (Game theory section). The streak, rest days, mastery and badges are specified in `docs/specs/practice-layer.md` and this hub plugs into them.

Implementation follows the repo's TDD style: a `test: … (Gn, red)` commit, then the implementation commit.

## 1. Scope

In scope:

- **Flash cards** for 18 game-theory concepts, on their own deck.
- **Puzzles** on generated 2×2 and 3×3 payoff matrices: click the equilibrium, classify the game, eliminate dominated strategies. These need a small pure solver.
- **Bots**: a repeated Prisoner's Dilemma against eight named strategies, name-the-bot, and a small tournament.
- **Contests**: the beauty contest ("guess 2/3 of the average") and first-price, second-price and common-value auctions against simulated bidders.
- **Tutorials** (Explore → Try → Solo) and a concept map with prerequisites and mastery states.
- A **daily puzzle** and eight game-theory **badges**, registered into the practice layer.

Out of scope:

- Leaderboards, XP, levels and leagues; real-crowd data, accounts or sync.
- Extensive-form tree UI, Bayesian games, signalling, mechanism design, Shapley value and the folk theorem. Designed for, not done.
- Weak-dominance elimination and mixed-strategy dominance (order-dependent or non-trivial to grade).
- A payoff builder, a design-a-strategy table and a mixed-strategy slider. Designed for, not done.
- Timers and time pressure, push reminders, sharing, and N-player matrix games (the tragedy of the commons is a card only).
- Adding any game-theory concept to the shared knowledge base (§2).

## 2. What the audit found

- **The pattern to follow is calibration.** It is an isolated mini-app with its own models, pages, history and a pure core with an injected rng (`CALIBRATION_RNG`, `draw.ts:13`). Calibration spec §1 explicitly rejects a "generalized quiz kinds engine". Flash-card pages must not import `features/round` or `features/report`.
- **The `Question` type can't carry a matrix or a bot.** `options: string[]` and `correctAnswers: string[]` hold neither. Interactive results reduce to a synthesised `ScoredQuestionResult` fed to `StatsService.recordResult`, as the flash-card round page does, so accuracy and reset-all come for free.
- **Game theory must not join the shared knowledge base.** `buildCard` fills lures from every `kb.concepts` entry (`card-builder.ts:78`), so game-theory names would appear on Biases and Fallacies cards. `knowledge-base.spec.ts` hard-codes 16 concepts (7 biases, 9 fallacies) and 4 pairs, and the KB-wide version-bump rule would couple unrelated quizzes.
- **Flash cards pass `Math.random` directly** (`flash-card-round-page.ts:168-169`). Only calibration has an injected token, so an injected rng here is new infrastructure.
- **There are three copies of `shuffle`** (`core/utils/shuffle.ts`, `calibration/draw.ts`, `round/round-builder.ts`). This hub uses `core/utils/shuffle.ts`.
- **`StatsService.resetQuiz(id)` clears one key.** A mini-app with several keys needs its own reset; `resetAll()` already clears the whole `stats:` prefix.
- **"Streak" is taken.** `QuizStats.streak` is consecutive correct answers. The hub never says "streak" on its own; the daily one is the **Practice streak** (practice-layer spec).
- **Design-system S1–S11 have landed.** Manifest entries no longer have an `accent`, `icon` is still required, and `design-system.spec.ts` has no allowlist, so every template in `features/game-theory/` is checked from its first commit.
- **There is no `docs/adr/` directory**, although `CLAUDE.md` points to one. Decisions are recorded in the spec.

## 3. Architecture

### 3.1 One manifest entry, one hub

```jsonc
{
  "id": "game-theory",
  "title": "Game Theory",
  "description": "Learn how people and bots make choices when outcomes depend on each other.",
  "icon": "icons/game-theory.svg",
  "version": 1,
  "dataPath": "data/quizzes/game-theory/",
  "order": 7,
  "kind": "game-theory",
}
```

- `QuizManifestEntry.kind` gains `'game-theory'`. `ROUTE_PREFIX` and `routeFor` (both in `features/library/library-cards.ts`) get an entry and a singleton special case, because the hub has one fixed path. Without it the card links to `#/game-theory/game-theory`.
- **Rejected: one entry per piece** (cards, puzzles, bots, contests). It means four library cards, several new `kind`s each needing a `ROUTE_PREFIX` entry and a `toCard` branch, and splits mastery, the daily puzzle and badges across entries. That is the generalized kinds engine calibration §1 rules out.
- **Rejected: game theory as a third flash-card kind.** It forks every hard-coded `'bias' | 'fallacy'` assumption: `FLASH_HOME` (`stats-page.ts`), `BACK_LABELS`, `deckForKind`, `LEGENDS` and the route `data.conceptType`.
- The hub's mode list is a plain array in the hub page, not a plugin registry.
- Summaries show **in the page**, with no report routes, which avoids the `history.state` loss on reload that the report pages have.
- `LibraryPage.toCard` gets a branch for `game-theory`: rounds played, "Concepts mastered N / 18" read from the stored `learn.summary` with no content fetch, and "Daily puzzle: open / done". It does not use the "Current streak" row, and `streak` is 0 for the "most recently played" heuristic, as calibration does.

### 3.2 Routes

| Path                         | Page                                                                       | Added in |
| ---------------------------- | -------------------------------------------------------------------------- | -------- |
| `game-theory`                | Hub: concept map, mode list, insights                                      | G1       |
| `game-theory/cards`          | Cards round                                                                | G10      |
| `game-theory/puzzles/:kind`  | `equilibrium`, `classify`, `eliminate` or `mixed` (interleaved), sets of 5 | G16      |
| `game-theory/learn/:concept` | Tutorial                                                                   | G17      |
| `game-theory/puzzles/:kind?solo=…&mode=test` | Test out, a three-item solo set (§7.2). It has no route of its own | G17      |
| `game-theory/bots/:mode`     | `play`, `name` or `tournament`                                             | G20      |
| `game-theory/play/:game`     | `beauty-contest`, `first-price`, `second-price` or `common-value`          | G24      |
| `game-theory/daily`          | Daily puzzle                                                               | G27      |

The hub's routes sit in one `GAME_THEORY_ROUTES` child table (`game-theory.routes.ts`), mounted once under `game-theory`. `app.routes.spec.ts` goes from 18 routes to 19 a single time, and each slice adds its own row to the child table and to `game-theory.routes.spec.ts`. See `game-theory-prefactor.md` T5.

### 3.3 Folder layout

```
public/data/quizzes/game-theory/   concepts.json  tutorials.json  checks.json  README.md
src/app/features/game-theory/
  lib/    PURE TS. No Angular, DOM, storage, Math.random, Date.now, or no-argument new Date()
          rng matrix dominance mixed classify puzzles/* bots match beauty auctions daily badges
  data/   game-theory-data.service.ts
  state/  gt-evidence.service gt-learn.service gt-games.service gt-tokens storage
  ui/     payoff-matrix  move-strip  mastery-node
  pages/  home  tutorial  cards  puzzle-set  daily  bots  play
```

- `PayoffMatrix` lives in `game-theory/ui/`, not `shared/ui/`, because `shared/ui` must not import from `features/` or `core/`.
- **Boundaries.** `game-theory-boundaries.spec.ts` allows imports from `core/**`, `shared/ui/**`, `features/flash-cards/{card-builder,draw-weights,feedback}` and `features/glossary/glossary-search`, and forbids `features/{round,report,calibration,quiz-home,library,stats}`.
- **Offline.** The hub, puzzles, bots and contests need no fetched content, so they work offline even on a first visit. Cards, tutorials and the map need `concepts.json`, `tutorials.json` and `checks.json`; the existing `data/quizzes/**/*.json` cache group covers them, so `ngsw-config.json` doesn't change. When they can't load, those pages show a "Couldn't load… Retry" state, as the calibration bank-unavailable state does.

## 4. Pure foundations

### 4.1 Randomness and time

```ts
// lib/rng.ts
export type Rng = () => number; // [0, 1)
export function hashSeed(s: string): number; // xmur3, uint32
export function mulberry32(seed: number): Rng;

// state/gt-tokens.ts
export const GAME_THEORY_RNG = new InjectionToken<Rng>('GAME_THEORY_RNG', {
  providedIn: 'root',
  factory: () => Math.random,
});
```

- Dates, the clock (`APP_CLOCK`), the streak and mastery come from the practice layer (`core/utils`), not from here.
- Pages draw from `GAME_THEORY_RNG`. Tutorials with fixed worked games need no rng. The daily puzzle and name-the-bot matches build `mulberry32(hashSeed(key))` themselves.
- Every pure generator documents its rng draw order, as `buildCard` does.

### 4.2 Test strategy

- Scripted rng sequences pin exact draws; `mulberry32(seed)` loops over seeds 0–499 run property tests (no new dependency).
- **Property tests:**
  - the solver against a brute-force reference;
  - class invariance under the 8 relabellings (swap rows, swap columns, swap players);
  - generated puzzles satisfy their spec (unique equilibrium at difficulty 1, trace length equals the target, class equals the intended class);
  - the rejection-loop fallback is never used in 1000 seeds;
  - strict elimination is order-independent: every legal order reaches the same final set;
  - mixed equilibrium: the indifference equations hold in exact fractions;
  - auctions and the beauty contest: seeded Monte Carlo with stated tolerances;
  - bots: every pair has a probe history that distinguishes them.
- **Guards.** `lib/purity.spec.ts` scans `lib/**/*.ts` (excluding specs) for banned imports (`@angular/`) and banned APIs (`Math.random`, `Date.now`, `new Date()` with no argument, `localStorage`). The boundaries spec is in §3.3.

## 5. Matrix core and puzzles

### 5.1 Matrix model and solver

```ts
export type Player = 'row' | 'col';
export interface CellRef {
  r: number;
  c: number;
}
export interface PayoffMatrix {
  rows: number;
  cols: number; // integer payoffs
  row: number[][]; // row[r][c] = the row player's payoff
  col: number[][]; // col[r][c] = the column player's payoff
}
export interface MatrixGame {
  rowLabels: string[];
  colLabels: string[];
  payoffs: PayoffMatrix;
  story?: string; // cover story, varied for transfer
}
// GameClass ids equal concept ids, so a correct classification credits that concept.
export type GameClass =
  | 'prisoners-dilemma'
  | 'stag-hunt'
  | 'chicken-game'
  | 'battle-of-the-sexes'
  | 'coordination-game'
  | 'other';
export interface Fraction {
  num: number;
  den: number;
} // reduced, den > 0
export interface MixedNash2x2 {
  p: Fraction; // P(row plays row 0)
  q: Fraction; // P(column plays column 0)
  rowValue: Fraction;
  colValue: Fraction;
}
export interface EliminationStep {
  player: Player;
  eliminated: number;
  dominatedBy: number;
  remainingRows: number[];
  remainingCols: number[];
}
```

| Function                        | Behaviour                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bestResponses(m, player, opp)` | All argmax indices, so ties are preserved                                                                                                                                                                                               |
| `bestResponseMarks(m)`          | Two boolean matrices, drawn as underlines                                                                                                                                                                                               |
| `pureNash(m): CellRef[]`        | Cells where both players are at a best response (weak inequality)                                                                                                                                                                       |
| `paretoOptimal(m): CellRef[]`   | Cells no other cell weakly improves for both and strictly for one                                                                                                                                                                       |
| `strictlyDominates(m, p, a, b)` | Strict, pure-strategy dominance only                                                                                                                                                                                                    |
| `eliminationTrace(m)`           | Iterated strict elimination in canonical order: lowest index first, row player before column player                                                                                                                                     |
| `mixedNash2x2(m)`               | `q = (r11 − r01) / (r00 − r01 − r10 + r11)`, `p = (c11 − c10) / (c00 − c10 − c01 + c11)`; `null` unless both denominators are non-zero and `0 < p, q < 1`. Integer fractions with gcd reduction; floats are never compared for equality |
| `classify2x2(m): GameClass`     | Per player, take the dense rank of its four payoffs (ties share a rank). Minimise the 8-symmetry rank tuple lexicographically. Compare to templates built by the same function at module load. Anything else is `'other'`               |

The five classification templates (a test asserts their signatures are distinct):

| Class               | Canonical game                                |
| ------------------- | --------------------------------------------- |
| Prisoner's Dilemma  | T4 R3 P1 S0 (T > R > P > S)                   |
| Stag Hunt           | R4 T3 P2 S1                                   |
| Chicken             | T4 R3 S2 P1                                   |
| Battle of the Sexes | (2,1) and (1,2) on the diagonal, (0,0) off it |
| Pure coordination   | (1,1) on the diagonal, (0,0) off it           |

### 5.2 Puzzles

```ts
export type PuzzleKind = 'equilibrium' | 'classify' | 'eliminate';
export type Difficulty = 1 | 2 | 3;
export type PuzzleTag = 'ne-not-pareto' | 'no-pure-ne' | 'multiple-ne';
interface PuzzleBase {
  kind: PuzzleKind;
  difficulty: Difficulty;
  game: MatrixGame;
  conceptIds: string[];
  tags: PuzzleTag[];
  seedKey: string;
}
export interface EquilibriumPuzzle extends PuzzleBase {
  kind: 'equilibrium';
  solution: CellRef[];
}
export interface ClassifyPuzzle extends PuzzleBase {
  kind: 'classify';
  solution: GameClass;
  choices: GameClass[];
}
export interface EliminatePuzzle extends PuzzleBase {
  kind: 'eliminate';
  solution: EliminationStep[];
  finalCells: CellRef[];
}
export type Puzzle = EquilibriumPuzzle | ClassifyPuzzle | EliminatePuzzle;
export type PuzzleAnswer =
  | { kind: 'equilibrium'; cells: CellRef[] } // empty = "no pure equilibrium"
  | { kind: 'classify'; choice: GameClass }
  | { kind: 'eliminate'; moves: { player: Player; index: number }[]; done: boolean };
export interface PuzzleGrade {
  correct: boolean; // what StatsService records
  score: number; // 0..1 partial credit, shown only
  cellVerdicts?: Record<string, 'tp' | 'fp' | 'fn' | 'tn'>; // key "r,c"
  firstIllegalMove?: number;
  stoppedEarly?: boolean;
  note: string; // misconception-aware text
}
export function generatePuzzle(
  kind: PuzzleKind,
  difficulty: Difficulty,
  rng: Rng,
  opts?: { avoid?: string[] },
): Puzzle;
export function gradePuzzle(p: Puzzle, a: PuzzleAnswer): PuzzleGrade;
export function matrixSignature(g: MatrixGame): string; // canonical form, avoids repeats
```

Generators use integer payoffs 0–9 and rejection sampling capped at 500 tries, then an authored fallback.

| Puzzle      | Difficulty 1                     | Difficulty 2                                                                  | Difficulty 3                                       |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Equilibrium | 2×2, unique equilibrium, no ties | 2×2 with 0, 1 or 2 equilibria weighted .2/.4/.4, at least 25% `ne-not-pareto` | 3×3 with 1–3 equilibria, ties in at most one place |
| Classify    | All five classes, interleaved    | Adds random relabelling and swapped players (always applied)                  | Adds cover-story variety                           |
| Eliminate   | 3×3 with one step                | Two alternating steps                                                         | Three or four steps down to a single cell          |

- Classify generators emit strict-ordinal games except for the coordination and Battle of the Sexes classes, whose templates tie the off-diagonal cells (classify2x2 cannot recognise a strict opposed-preference game as either). Otherwise they draw four increasing integers per player for the ranks, then relabel at random.
- Elimination grading accepts **any legal order** and reports the first illegal move, stopping early and over-stepping. The stepper claims only "dominated by another strategy".
- Cover-story labels come from neutral, varied pools (firms, neighbours, countries, drivers). They avoid money framing (§11, rule 1).
- `matrixSignature` is used to avoid repeating a recently seen matrix, so spaced practice doesn't memorise one matrix.

### 5.3 Reason checks

Every puzzle, and the contests, can be followed by a one-answer **reason check** that asks why the answer is right. A right answer with a wrong reason is shown, and recorded, separately.

```ts
export type MisconceptionId =
  'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M10' | 'M11' | 'M12' | 'M13' | 'M14'; // M9 is not used
export interface ReasonCheck {
  id: string;
  conceptId: string;
  context:
    | 'equilibrium'
    | 'classify'
    | 'eliminate'
    | 'bots'
    | 'beauty'
    | 'auction-first'
    | 'auction-second'
    | 'auction-common'
    | 'daily';
  prompt: string;
  options: {
    id: string;
    text: string;
    correct: boolean;
    misconceptionId?: MisconceptionId;
    why: string;
  }[];
}
```

The misconception list is in §11. Each reason check has exactly one correct option and at least one option that targets a named misconception.

## 6. Concepts and content

### 6.1 Widening the card cores (types only)

Game theory gets a sibling type on a shared base. `Concept['type']` stays `'bias' | 'fallacy'`, so every existing consumer is unaffected.

```ts
// core/models/quiz.models.ts
export interface CardConcept {
  id: string;
  name: string;
  shortDefinition: string;
  longExplanation: string;
  example: string;
  spottingTip?: string;
  type: string;
}
export interface Concept extends CardConcept {
  type: 'fallacy' | 'bias';
}
export interface ConceptSet<C extends CardConcept> {
  concepts: C[];
  pairs: ConfusedPair[];
}
export type KnowledgeBase = ConceptSet<Concept>; // unchanged
export interface GameTheoryConcept extends CardConcept {
  type: 'game-theory';
  tier: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  misconception?: MisconceptionId;
  source?: { label: string; url: string };
  modes: ('cards' | 'equilibrium' | 'classify' | 'eliminate' | 'bots' | 'beauty' | 'auction')[];
}
export interface GameTheoryContent {
  version: number;
  concepts: GameTheoryConcept[];
  pairs: ConfusedPair[];
}
```

Files touched, all behaviour-preserving and with existing specs required to pass unchanged:

1. `core/models/quiz.models.ts`: add `CardConcept`, `ConceptSet<C>`, `GameTheoryConcept`; make `Concept extends CardConcept`; add `'game-theory'` to the `kind` union.
2. `features/flash-cards/card-builder.ts`: make `buildCard` and `FlashCard` generic over `C extends CardConcept`; widen `LEGENDS` (`:25`) to `Record<CardDirection, Record<string, string>>`; add `'game-theory'` legends ("Which idea is this?", "Which idea does this example show?", "What does this idea mean?") and a fallback legend for unknown types.
3. `features/flash-cards/draw-weights.ts`: change the `Concept` parameter types to `CardConcept` (generic on `pickTarget`, `drawTarget`, `applyBump`).
4. `features/flash-cards/feedback.ts`: `Contrast`, `Feedback` and `buildFeedback` take `CardConcept`.
5. `features/glossary/glossary-search.ts`: make `confusedWith` and `pairTip` generic.

Not touched: `knowledge-base.json` and its spec, `FLASH_HOME`, `BACK_LABELS`, `deckForKind`, the `conceptType` route data, and the flash-card and stats pages. The fallback, if zero edits to flash-card files are wanted, is a roughly 100-line duplicate `buildGtCard` with its own specs. It is not recommended, because the two copies would drift.

### 6.2 The 18 concepts

`id` is the kebab-case name. Tier 1 is foundational; tier 5 is the most advanced.

| Tier | Concepts                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `dominant-strategy`, `iterated-elimination`, `best-response`, `nash-equilibrium`, `pareto-efficiency`, `prisoners-dilemma`, `stag-hunt`, `chicken-game`, `coordination-game`, `battle-of-the-sexes`, `mixed-strategy` |
| 2    | `backward-induction`                                                                                                                                                                                                  |
| 3    | `repeated-game`, `tit-for-tat`                                                                                                                                                                                        |
| 4    | `first-price-auction`, `second-price-auction`, `winners-curse`                                                                                                                                                        |
| 5    | `level-k-reasoning`                                                                                                                                                                                                   |

Candidates for later: subgame-perfect-equilibrium, zero-sum and minimax, evolutionarily stable strategy, the folk theorem, public goods, focal points, Shapley value, mechanism design.

### 6.3 Ten confused pairs

Each has a pair tip naming both sides.

1. `prisoners-dilemma` / `stag-hunt`: a dominant strategy to defect versus two equilibria, one of them good.
2. `prisoners-dilemma` / `chicken-game`: in Chicken, mutual defection is the worst outcome and there is no dominant strategy.
3. `nash-equilibrium` / `pareto-efficiency`: stable versus no free improvement.
4. `stag-hunt` / `coordination-game`: risk-dominant versus payoff-dominant.
5. `coordination-game` / `battle-of-the-sexes`: a shared versus a conflicting preferred equilibrium.
6. `dominant-strategy` / `best-response`: best against every move versus best against a specific move.
7. `nash-equilibrium` / `backward-induction`: empty threats.
8. `first-price-auction` / `second-price-auction`: shading versus truthful bidding.
9. `prisoners-dilemma` / `repeated-game`: one-shot versus reciprocity.
10. `nash-equilibrium` / `level-k-reasoning`: the model versus how people actually play.

### 6.4 Prerequisite graph

A DAG, guarded against cycles and against a concept having a prerequisite of a higher tier.

| Concept                                                                     | Prerequisites                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `dominant-strategy`, `best-response`, `pareto-efficiency`                   | none (roots)                                                 |
| `iterated-elimination`                                                      | `dominant-strategy`                                          |
| `nash-equilibrium`                                                          | `best-response`                                              |
| `prisoners-dilemma`                                                         | `dominant-strategy`, `nash-equilibrium`, `pareto-efficiency` |
| `stag-hunt`                                                                 | `nash-equilibrium`, `pareto-efficiency`                      |
| `chicken-game`, `coordination-game`, `mixed-strategy`, `backward-induction` | `nash-equilibrium`                                           |
| `battle-of-the-sexes`                                                       | `coordination-game`                                          |
| `repeated-game`                                                             | `prisoners-dilemma`                                          |
| `tit-for-tat`                                                               | `repeated-game`                                              |
| `second-price-auction`                                                      | `dominant-strategy`                                          |
| `first-price-auction`                                                       | `best-response`, `second-price-auction`                      |
| `winners-curse`                                                             | `first-price-auction`                                        |
| `level-k-reasoning`                                                         | `iterated-elimination`, `best-response`                      |

### 6.5 Authoring guards

Spec tests over the JSON imports (the `bank-version.spec.ts` pattern):

- Concept ids are unique, kebab-case and disjoint from knowledge-base ids; required fields are present; `tier` is 1–5; every prerequisite exists; there is no cycle; `tier ≥` each prerequisite's tier; `modes` values are valid.
- Pairs have known ids, no self-pair and no duplicate in either order, and every pair has a tip.
- `concepts.json`, `tutorials.json` and `checks.json` each have a `version` equal to the manifest entry's `version`.
- Every concept whose `modes` include `equilibrium`, `classify` or `eliminate` has a hand-written tutorial script. Every other concept gets the default card script (§7.1).
- Every concept whose `requiresChallenge` is true has at least one challenge source: a puzzle credit (§9.1), a bot's `conceptIds`, or a reason check.
- Reason checks: exactly one correct option and at least one misconception-tagged option; `conceptId` exists.
- Every in-scope misconception (M1–M8, M10–M14) is referenced by at least one concept or check option, so §11's list isn't decorative.
- Every tutorial annotation's marks agree with the solver (§7.1).
- Any numeric empirical claim (for example the beauty-contest mean) carries a `source` link.
- A knowledge-base-style authoring guideline lives in `public/data/quizzes/game-theory/README.md`: editing any of the three files bumps the manifest `version`, and concept ids are never reused.

## 7. Tutorials, mastery and gating

### 7.1 Three stages per concept

```ts
type TutorialStep =
  | { stage: 1; kind: 'text'; blocks: string[]; callout?: string }
  | {
      stage: 1;
      kind: 'worked';
      game: MatrixGame;
      annotations: { text: string; mark?: MarkName; at?: CellRef }[];
    }
  | { stage: 2; kind: 'faded'; game: MatrixGame; task: FadedTask; hints: string[] }
  | { stage: 2; kind: 'card'; hints: string[] }
  | { stage: 3; kind: 'solo'; source: SoloSource; count: 3; passAt: 2 };
interface TutorialScript {
  conceptId: string;
  steps: TutorialStep[];
}
type MarkName = 'best-response-row' | 'best-response-col' | 'equilibrium' | 'dominated' | 'pareto';
type FadedTask = 'underline-best-responses' | 'find-equilibrium' | 'find-pareto' | 'eliminate-next';
type SoloSource =
  { puzzle: PuzzleKind; difficulty: Difficulty } | 'cards' | 'name-bot' | 'reason-check';
```

| Stage     | What the player sees                                                                                                                         | Evidence recorded |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1 Explore | An optional ungraded predict-first question, then the idea as a worked example. One annotation is revealed per **Next**. The term comes last | none              |
| 2 Try     | The same widget with part of the work done (for example 2 of 4 best-response underlines given). Hints are on demand, each revealing the next | none (assisted)   |
| 3 Solo    | 3 freshly generated items, no hints. Pass at 2 of 3, otherwise a fresh set and a one-line misconception note                                 | yes               |

- **Marks come from the solver, never from authored text** (`MarkName` selects which solver output to draw), so tutorial text can't contradict the solver. A guard checks every annotated game.
- Progressive disclosure: one idea per screen, and payoffs are revealed gradually (first only the row player's, then both).
- A hint-assisted item never records evidence.
- **Test out.** A 3-item check using the Solo generators. A 3 of 3 pass sets `testedOut` and `stage = 3`, and skips to practice. Its source comes from the concept: `{equilibrium, 1}` for `best-response` and `nash-equilibrium`, `{equilibrium, 2}` for `pareto-efficiency` (so `ne-not-pareto` items come up), `{eliminate, 1}` for `dominant-strategy` and `iterated-elimination`, `{classify, 1}` for the five classes, and `cards` for the default-script concepts. Name-the-bot and reason checks are not test sources in v1.
- Hand-written tutorials cover the ten concepts whose `modes` include `equilibrium`, `classify` or `eliminate`. The other eight get a **default script** built in code from their `concepts.json` entry: a text Explore, one card Try with a hint, and a Solo cards set.
- G17 ships two seed tutorials (`best-response`, `nash-equilibrium`). G29 writes the other eight hand-written ones.

### 7.2 Introduced and gating

- A concept is **introduced** when its tutorial has reached Try (`stage ≥ 2`) or it has been tested out.
- Card targets and puzzle concepts are drawn **only from introduced concepts**. Lures can come from the whole deck.
- With nothing introduced, the Cards and Puzzles pages show an `EmptyState` with "Start with Best response" and a Test out link.
- **There is no hard lock on access.** A node whose prerequisites are unmet shows "Recommended first: X" but still opens.
- **Difficulty is gated, not access:** difficulty-2 equilibrium puzzles and the interleaved `mixed` sets need `nash-equilibrium` Practised; difficulty 3 needs it Mastered; 3×3 elimination needs `dominant-strategy` Practised.

### 7.3 Mastery

Mastery states come from the shared `masteryOf` (practice-layer spec §6). For game theory, `ConceptEvidence.requiresChallenge` is true for any concept whose `modes` includes something other than `'cards'`, and `challengeAttempts` comes from `stats:game-theory:challenges`. `attempted` and `correct` pool `cards` and `challenges`.

The hub's map groups concepts by tier. Each node shows a glyph and its word: ○ New, ◔ Learning, ◑ Practised, ● Mastered. Colour is never the only signal.

## 8. Bots and contests

### 8.1 Bots and matches

```ts
export type Move = 'C' | 'D';
export type BotId =
  | 'copycat'
  | 'always-cooperate'
  | 'always-cheat'
  | 'grudger'
  | 'detective'
  | 'copykitten'
  | 'simpleton'
  | 'random';
export interface StrategyContext {
  turn: number;
  mine: readonly Move[];
  theirs: readonly Move[]; // the opponent's PLAYED moves, after noise
  rng: Rng;
}
export interface Bot {
  id: BotId;
  name: string;
  blurb: string;
  tell: string; // the observable giveaway, shown after a reveal
  conceptIds: string[];
  confusableWith: BotId[];
  decide(ctx: StrategyContext): Move; // stateless, derived from the full history
}
export interface PdPayoffs {
  T: number;
  R: number;
  P: number;
  S: number;
} // default 5/3/1/0; T>R>P>S and 2R>T+S asserted
export type Horizon =
  { kind: 'fixed'; turns: number } | { kind: 'continue'; p: number; cap: number };
export interface MatchConfig {
  a: BotId | 'human';
  b: BotId;
  horizon: Horizon;
  noise: number; // 0..0.1, flips PLAYED moves
  payoffs: PdPayoffs;
  seed: string;
}
export interface TurnRecord {
  index: number;
  intendedA: Move;
  intendedB: Move;
  playedA: Move;
  playedB: Move;
  payoffA: number;
  payoffB: number;
}
export interface MatchResult {
  config: MatchConfig;
  turns: TurnRecord[];
  totalA: number;
  totalB: number;
  mutualCooperation: number;
}
export interface TournamentResult {
  population: BotId[];
  noise: number;
  reps: number;
  meanPerTurn: Record<BotId, number>;
  ranking: BotId[];
}
// stepTurn(state, humanMove | null, rng) drives human play one turn at a time.
// playMatch(config, rng) is bot against bot. roundRobin(population, cfg, rng) is the tournament.
// replicatorStep(shares, scoreMatrix) is the optional population view (G23).
```

- Bots see the opponent's **played** (possibly noisy) moves. This is what produces echo spirals under noise.
- Per-turn rng draw order: A's noise draw, then B's, then any strategy draw (only `random` uses one).
- In human matches noise flips only the bot's moves, and the UI says so.
- **Play horizon** is `continue, p = 0.9, cap 40`. The player is told the continuation probability, not the number of turns, which models the shadow of the future and avoids end-game defection. **Tournaments** use a fixed 100 turns.
- Payoffs default to Axelrod's T5/R3/P1/S0, which satisfy `2R > T + S`. The Evolution of Trust's own payoffs were not verified.

| Bot                | Rule                                                                                    | Tell (revealed after the match)                   |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `copycat`          | Cooperate, then copy the opponent's last played move                                    | Mirrors you, one turn late                        |
| `always-cooperate` | Always cooperate                                                                        | Never retaliates                                  |
| `always-cheat`     | Always defect                                                                           | Never cooperates                                  |
| `grudger`          | Cooperate until the opponent has ever defected, then defect forever                     | Never forgives                                    |
| `detective`        | Open C, D, C, C. If the opponent never defected, defect forever; otherwise play Copycat | Odd opening, then exploits or mirrors             |
| `copykitten`       | Defect only after two consecutive opponent defections                                   | Forgives a single defection                       |
| `simpleton`        | Cooperate iff both players made the same move last turn (win-stay, lose-shift)          | Repeats after good outcomes, flips after bad ones |
| `random`           | 50/50 from the rng                                                                      | No pattern                                        |

- Logic is ported from `ncase/trust` (CC0), verified against this spec. **Port logic only, never assets**: that repository lists some sound assets under other licences, one of them non-commercial.
- Confusable sets (used to choose lures in name-the-bot): `copycat` ↔ `copykitten` ↔ `grudger` ↔ `simpleton`, and `detective` ↔ `copycat`.
- A test asserts that for every pair of bots a short probe script (for example defect at turn 2, then cooperate) yields different move sequences, so name-the-bot is always answerable.

**Name-the-bot.** The player plays 10 turns against a hidden bot, then picks its name from four options (the bot and three lures from its confusable set). It is graded and recorded as one scored attempt crediting the bot's `conceptIds`. Only the four bots with three or more confusable partners are named in v1 (`copycat`, `grudger`, `copykitten`, `simpleton`); see §14.

**Tournament.** Every bot in a chosen population plays every other for 100 turns, with a noise slider and population presets. The presets are *everyone* (all eight), *cooperative* (`always-cooperate`, `copycat`, `copykitten`, `simpleton`) and *hostile* (`always-cheat`, `detective`, `random`, `grudger`). The ranking is computed live. A follow-up check asks "Did the winner change?" after the player changes the population or noise.

### 8.2 Beauty contest

```ts
export type LevelLabel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4+';
export interface BeautyConfig {
  simulated: number; // default 12
  p: number; // default 2/3
  mix: Record<'L0' | 'L1' | 'L2' | 'L3', number>;
  sigma: number;
  seed: string;
}
export interface BeautyResult {
  guesses: number[];
  human: number;
  mean: number; // includes the human's guess
  target: number;
  winnerIndex: number; // -1 means the human won
  humanLevel: LevelLabel;
  levelCounts: Record<LevelLabel, number>;
}
```

- `levelGuess(k)`: L0 is uniform on [0, 100]; Lk is `50·p^k` plus `N(0, sigma)`, clipped to [0, 100]. `levelOf(g)` is the nearest `k` in 0–4 to `50·p^k`.
- Default mix {L0 .3, L1 .4, L2 .2, L3 .1} with `sigma` 5, so the expected mean is about 34. A seeded Monte Carlo test asserts the simulated mean lies in [30, 40].
- It is a **model of players, not data about people**, and the UI labels it "Simulated players (a model, not real people)". There is no backend, so there is no real crowd.
- The reveal shows the mean, a level histogram of the simulated players, and "0 is the equilibrium but not the winning guess".
- Real figures appear only with a source link: Nagel (1995) reported a mean near 36; the Politiken newspaper game had 19,196 entrants and an **average** of 33, which makes the winning guess about 22 (`2/3 × 33`).

### 8.3 Auctions

```ts
export type AuctionFormat = 'first-price' | 'second-price';
export type ValueModel = 'private' | 'common';
export interface AuctionSetup {
  format: AuctionFormat;
  model: ValueModel;
  bidders: number; // 3..8
  values?: number[]; // private: iid integer U[0, 100]
  trueValue?: number; // common: V in [50, 150]
  signals?: number[]; // common: s_i = V + U[-eps, eps], eps = 20
  noise?: number;
  seed: string;
}
export type BidPolicyId =
  'truthful' | 'equilibrium-shade' | 'naive-signal' | 'curse-aware' | 'noisy-shade';
export interface AuctionOutcome {
  bids: number[];
  winner: number;
  price: number;
  payoffs: number[];
  valueOrTruth: number[];
}
```

- **First-price, private values:** with `n` iid U[0, 100] risk-neutral bidders the equilibrium bid is `b(v) = v·(n − 1)/n`. A test checks it with a grid argmax of `(v − b)·(b·n / ((n − 1)·100))^(n − 1)`.
- **Second-price, private values:** bidding your value `b(v) = v` is dominant. A test checks dominance by brute force over integer bids.
- **Common value** (the winner's curse): when everyone bids monotonically in their signal, the winner is the bidder with the highest noise draw. The winner's expected overshoot is exactly `ε·(n − 1)/(n + 1)`, for any `V`. The `curse-aware` policy bids `s − ε·(n − 1)/(n + 1) − margin`. Seeded Monte Carlo tests show naive winners average a loss for `n ≥ 4` and `curse-aware` does not.
- The UI says "in this setup" and does not generalise beyond private iid values, risk neutrality and uniform noise.
- A "simulate 1000 auctions" panel shows the result of a policy, so the player sees the effect, not just the claim.

## 9. Practice-layer integration, daily puzzle and badges

### 9.1 Which events call the recorder

`GtEvidenceService.record(conceptIds, correct, facet, now)` is the single write path for scored attempts. It updates `StatsService`, the learn summary, and calls `PracticeService.recordAttempt('game-theory', { conceptIds, count: 1 }, now)`.

| Event                                                                  | Scored attempt? | Concepts credited                                                                 |
| ---------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| Card check                                                             | yes             | the target                                                                        |
| Equilibrium puzzle submit                                              | yes             | `best-response`, `nash-equilibrium`, plus `pareto-efficiency` for `ne-not-pareto` |
| Classify puzzle submit                                                 | yes             | the correct `GameClass` concept                                                   |
| Eliminate puzzle submit                                                | yes             | `dominant-strategy`, `iterated-elimination`                                       |
| Name-the-bot guess                                                     | yes             | the bot's `conceptIds`                                                            |
| Reason check answered                                                  | yes             | the check's `conceptId`                                                           |
| Solo and Test-out items                                                | yes             | the item's concepts                                                               |
| Daily puzzle answered                                                  | yes             | and `recordDaily`, which also makes the day a practice day                        |
| Explore and Try steps, hint-assisted items                             | no              | —                                                                                 |
| Free-play bot turns, tournament runs, beauty-contest and auction plays | no              | — (only their reason checks count)                                                |

Lures get no counts. A two-concept puzzle credits both concepts. The 'did the winner change?' check after a tournament is unscored: it is computed from the two runs and stored in the tournament summary.

### 9.2 Daily puzzle

- **Seed:** `mulberry32(hashSeed('gt-daily/v1/' + dateKey))`. No backend.
- **Kind** is chosen from the kinds the puzzle-set page can draw (§7.2, the same drawable-kind rule) by `dayNumber(dateKey) % kinds.length`. Difficulty is `min(2, the highest level whose gates are met)`, so it is always solvable.
- **Plan lock-in.** The first open of the day stores `{ kind, difficulty, seedKey }` in `stats:game-theory:plan`, so mastering a concept mid-day can't change today's puzzle.
- **Availability.** It unlocks once `nash-equilibrium` is introduced. Before then the hub says "Unlocks after Nash equilibrium."
- **Grading.** One attempt through `gradePuzzle`, then a reason check. The answer's correctness is the recorded result; the reason is shown separately and informationally.
- **Storage.** `stats:game-theory:learn` holds the last 60 dates' `{ kind, correct, reasonCorrect }`. The Today panel shows the last 14 days as glyphs (✓ ✗ ·).
- The daily puzzle differs by timezone because it is keyed to the local date. That is acceptable, since nothing is shared and there is no leaderboard.

### 9.3 Eight game-theory badges

Registered into the practice-layer registry (§8 there). Informational, never summed.

| Badge                  | The player has shown…                              | Criterion                                                                                                             |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `equilibrium-spotter`  | a stable cell is one nobody gains by leaving alone | `nash-equilibrium` Mastered                                                                                           |
| `not-the-best-outcome` | an equilibrium can be worse for everyone           | 3 correct `ne-not-pareto` puzzles on different matrices                                                               |
| `dominance-climber`    | iterated reasoning                                 | 5 correct eliminations of at least 2 steps                                                                            |
| `game-sorter`          | the five classes are different                     | At least 20 classify items, at least 90% correct, all five classes seen                                               |
| `bot-whisperer`        | a strategy can be read from behaviour              | 5 distinct bots named correctly                                                                                       |
| `contingent-winner`    | the best strategy depends on who else is playing   | A tournament run under two populations or noise levels, plus the "did the winner change?" check answered correctly    |
| `two-steps-ahead`      | iterated reasoning in a contest                    | Beauty-contest reason check correct, plus a guess within 15 of the level the player named                             |
| `bid-shader`           | the winner's curse                                 | Common-value auctions: bid below own signal with non-negative profit in 3 of 5, plus the auction reason check correct |

## 10. Persistence

All keys sit under `stats:game-theory:`, so `StatsService.resetAll()` clears them (a test covers it). Ids contain no colon, so these can't collide with `stats:<quizId>` or `stats:calibration:`. The streak, rest days, badges, concept practice days and the hide toggle live in `stats:app:practice` (practice-layer spec §5), not here.

| Key                            | Owner                                  | Shape                                                                | Written when                                                                |
| ------------------------------ | -------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `stats:game-theory:cards`      | `StatsService` via `GtEvidenceService` | `QuizStats`, trait = concept id                                      | each card check and each Solo or Test-out card item; `recordSessionEnd` at End if at least one card was checked |
| `stats:game-theory:plan`       | `GtLearnService`                       | today's `{ kind, difficulty, seedKey }`, one record, rebuilt when the date changes | first open of the day |
| `stats:game-theory:challenges` | `StatsService` via `GtEvidenceService` | `QuizStats`, trait = concept ids                                     | puzzles, Solo and Test-out items whose source is a puzzle, name-the-bot, reason checks, the daily |
| `stats:game-theory:learn`      | `GtLearnService`                       | tutorial stage and `testedOut` per concept, `summary`, daily history | stage changes and evidence                                                  |
| `stats:game-theory:games`      | `GtGamesService`                       | `GamesLog`: per-kind counts and up to 100 match summaries            | a completed match, tournament, contest or auction                           |

```ts
export type TutorialStage = 0 | 1 | 2 | 3; // none | explored | tried | solo passed
export interface ConceptLearn {
  stage: TutorialStage;
  testedOut: boolean;
}
export interface LearnState {
  version: 1;
  concepts: Record<string, ConceptLearn>;
  summary: { mastered: number; introduced: number; total: number }; // read by the library with no fetch
  daily: Record<string, { kind: PuzzleKind; correct: boolean; reasonCorrect: boolean }>; // last 60 dates
}
export type GameKind =
  | 'repeated-pd'
  | 'name-the-bot'
  | 'tournament'
  | 'beauty-contest'
  | 'first-price'
  | 'second-price'
  | 'common-value';
export interface MatchRecord {
  kind: GameKind;
  at: string;
  seed: string;
  summary: Record<string, string | number | boolean>;
}
export interface GamesLog {
  version: 1;
  counts: Record<GameKind, number>;
  records: MatchRecord[];
}
```

- **`StatsService` reuse.** `GtEvidenceService` synthesises a `ScoredQuestionResult` exactly as the flash-card round page does, with `question.traitIds` set to the credited concept ids. The `streak` field in these records is an answer streak and is unused in the hub's UI.
- **Why `cards` and `challenges` are separate.** The transfer clause of Mastered, and the draw weights, need to tell recognition from application. Card draw weights reuse `drawTarget`.
- **Two kinds of version.** Each key carries a schema `version`, migrated stepwise; an unknown or future version is treated as corrupt and returned zeroed. The manifest's content `version` must equal the version in the three JSON files (a build-time spec). `migrateContent(version, conceptIds)` runs on every hub load: it calls `StatsService.migrateVersion('game-theory:cards', …)` and the same for `challenges`, and prunes `learn` entries for removed ids. Concept ids are never reused.
- **No pending-round machinery.** Scored attempts are recorded immediately, so an abandoned set or match loses only its summary line. `roundsPlayed` is bumped only at End. Mid-match state isn't persisted, so a refresh abandons the match. A mid-stage tutorial position isn't saved; only the completed stage is. The one pre-answer artifact is the daily plan lock-in, which is harmless if unanswered.
- **Corruption and failure.** Reads never throw; every field is type-guarded with a default. Tests feed garbage JSON, wrong types, negative numbers and unknown versions. Writes are try/catch'd, and a failure shows "Progress can't be saved in this browser."
- **Reset.** The hub's reset button removes every `stats:game-theory:` key, because `StatsService.resetQuiz` handles only one. Library **Reset all progress** already covers them.
- Accepted: a failure between the writes of `StatsService`, `learn` and the practice layer can leave a derived summary briefly out of step. The impact is a wrong summary, not wrong evidence.

## 11. Honesty guardrails

Each is a rule the implementation and its tests must hold. The misconception ids are used by reason checks and the coverage guard.

1. **M1.** Payoff means "what the player cares about", never "money" or "selfish". The Prisoner's Dilemma tutorial notes that caring about the other player changes the payoffs, and so the game.
2. **M2, M4.** Never call an equilibrium "the best outcome" or "what players will do". Use "stable: no one gains by switching alone".
3. **M3.** Say "an equilibrium" or "the equilibria" unless uniqueness was verified. Generators include games with 0 and with 2 equilibria.
4. **M5.** Dominance does not imply a good outcome. Prisoner's Dilemma feedback shows the Pareto-better cell.
5. **M14.** The elimination stepper is strict and pure-strategy only. Weak elimination is order-dependent and can remove equilibria.
6. **M6.** Classification feedback names the feature that separates the classes (for example "defecting is dominant" for Prisoner's Dilemma, "mutual defection is the worst outcome" for Chicken).
7. **M7.** The backward-induction card shows an empty-threat example, so "Nash equilibrium" and "subgame-perfect" aren't conflated.
8. **M8.** "Copycat won Axelrod's tournaments" is tournament-specific. The tournament is computed live and its ranking shifts with population and noise. No UI string says "nice guys always win".
9. **M11, M12.** Thresholds read "in this simulation". Auction results read "in this setup".
10. **M10.** Mixed play makes the _other_ side indifferent. "Random" is not "no strategy".
11. **M13.** There is no real crowd. The beauty-contest players are labelled "Simulated players (a model, not real people)". Real figures carry a source link and state that results vary with who plays.
12. The Evolution of Trust thresholds (rounds, noise) are model-specific and are never stated as general facts.
13. No lab figure is generalised across cultures (ultimatum-game offers, for example, vary by culture).
14. No claim that gamification "improves learning".

## 12. Design-system compliance

`features/game-theory/` is checked by `design-system.spec.ts` from G1.

- Every page uses `<ui-page-shell>` with one `h1` and an eyebrow or back link. One `primary` button per view. Token utilities and `type-*` roles only. `data-testid` on every interactive element.
- **`PayoffMatrix`** is a `<table>` with a visually hidden `<caption>` and `<th scope="row|col">`. Each cell is a native `<button type="button" aria-pressed>` with an `aria-label` such as "Row Advertise, column Advertise: row 3, column 3". It is reachable by Tab, toggled by Space or Enter, shows the standard focus ring (`focus-visible:ring-2 ring-focus ring-offset-2 ring-offset-surface`) and uses `min-h-12`. A "None of these (no pure equilibrium)" button handles the empty answer. Arrow-key roving focus is optional polish.
- **Non-colour signals everywhere.** Best responses are underlined (the textbook convention). Equilibrium, correct, wrong and missed cells carry the existing glyphs (✓ ✗ !) and words through `OUTCOME_LOOK` and `ui-status`. Eliminated lines get `line-through` plus the text "Eliminated (step N)". The row and column players are labelled by text and never assigned colours.
- **Cell look.** Selected is `border-accent bg-accent-subtle`; correct, wrong and missed use the `success`, `danger` and `warning` tokens. Cells are buttons, so they can't use the `label[uiOption]` directive. The widget reuses the `OptionRowState` type and `OUTCOME_LOOK` tones.
- **Guard hazards to avoid:** no `fill="…"` named colours or hex in SVG attributes, no `[style.color]`-type bindings, no hex-shaped text in quoted attributes.
- **Charts.** HTML bars (`ui-progress`) plus a text table; no SVG and no colour-coded series. A turn history is a strip of `C` and `D` letters in `font-mono`, not a ✓ or ✗ strip.
- **Motion and pace.** Nothing auto-advances. Bot turns advance on the player's click, with a "Skip to end" option. No timers.
- Feedback uses `FeedbackPanel`; tips and misconception notes use `Callout`; "no introduced concepts" uses `EmptyState`.

## 13. Proposed implementation slices

TDD-sized, in dependency order. Each is a red commit followed by the implementation commit. `P*` slices are in `docs/specs/practice-layer.md`. These are proposals; turning them into issues is a separate step.

| #   | Slice                                                                                                                                                                       | Covers        | Depends on                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------- |
| G1  | Manifest `kind: 'game-theory'` and entry (order 7), `routeFor` singleton case, hub placeholder in `ui-page-shell` (routes → 19), basic library card, GLOSSARY additions     | §3.1–3.2      | —                           |
| G2  | `rng` (`hashSeed`, `mulberry32`), `GAME_THEORY_RNG`, the purity guard and the boundaries guard                                                                              | §3.3, §4      | —                           |
| G3  | Matrix model, best responses, pure Nash, Pareto, with brute-force reference tests                                                                                           | §5.1          | G2                          |
| G4  | Strict dominance and the iterated-elimination trace (order-independence property)                                                                                           | §5.1          | G3                          |
| G5  | `classify2x2`: 8-symmetry signatures, five templates, relabelling invariance                                                                                                | §5.1          | G3                          |
| G6  | `mixedNash2x2` with exact fractions and indifference tests _(cut candidate)_                                                                                                | §5.1          | G3                          |
| G7  | Behaviour-preserving widening of the card cores (`CardConcept`, `ConceptSet`, generic `buildCard`, `drawTarget`, `buildFeedback`, `confusedWith`); existing specs unchanged | §6.1          | —                           |
| G8  | `concepts.json` (18 concepts, 10 pairs, tips) and guards, `GameTheoryDataService`, the unavailable state                                                                    | §6.2–6.5      | G1, G7                      |
| G9  | `GtEvidenceService` (calls `PracticeService`), `GtLearnService`, unlock rules, the reset-all test                                                                           | §7.2, §9, §10 | G2, G8, P2, P4              |
| G10 | Cards page: introduced-only targets, feed, feedback via `buildFeedback`, recording, in-page summary, empty state (routes → 20)                                              | §7.2, §10     | G1, G7–G9                   |
| G11 | Equilibrium generator and grader (difficulties 1–3, tags, fallback never used)                                                                                              | §5.2          | G3                          |
| G12 | Classify generator and grader (relabel, interleave)                                                                                                                         | §5.2          | G5                          |
| G13 | Elimination generator and step grader _(cut candidate)_                                                                                                                     | §5.2          | G4                          |
| G14 | `PayoffMatrix` widget: select, mark, eliminate; keyboard, glyphs, tokens                                                                                                    | §12           | G1, G3                      |
| G15 | Reason checks: schema, seed `checks.json` (about 6), misconception registry and coverage guard                                                                              | §5.3, §6.5    | G8                          |
| G16 | Puzzle-set page (equilibrium, classify, eliminate, interleaved `mixed`), sets of 5, recording to `challenges`, reason check, summary (routes → 21)                          | §5, §9        | G9, G11–G15                 |
| G17 | Tutorial engine and page: script schema and guards, stages, hints, Test out, 2 seed tutorials (routes → 22)                                                                 | §7.1          | G9, G11, G14                |
| G18 | Mastery map on the hub; gating of card and puzzle pools; difficulty unlocks                                                                                                 | §7.2–7.3      | G10, G16, G17               |
| G19 | Bots, pure: roster, `stepTurn`, `playMatch`, noise, horizon, PD payoffs; distinguishability property test                                                                   | §8.1          | G2                          |
| G20 | Bots page `bots/play` and `GtGamesService` (routes → 23)                                                                                                                    | §8.1, §10     | G9, G14, G19                |
| G21 | Name-the-bot: lures from confusable sets, grading, evidence                                                                                                                 | §8.1          | G20                         |
| G22 | Tournament: round-robin, population presets, noise slider, "did the winner change?"                                                                                         | §8.1          | G19, G20                    |
| G23 | Replicator population view _(cut candidate)_                                                                                                                                | §8.1          | G22                         |
| G24 | Beauty contest: level-k core with the Monte Carlo band test, `play/:game` page, reason check (routes → 24)                                                                  | §8.2          | G2, G9, G15                 |
| G25 | Auctions, pure: first-price, second-price, common-value, bid policies, formula tests                                                                                        | §8.3          | G2                          |
| G26 | Auction pages (reusing `play/:game`), reason checks, the "simulate 1000 auctions" panel                                                                                     | §8.3          | G24, G25, G15               |
| G27 | Daily puzzle: seed, plan lock-in, rotation, page and history strip (routes → 25)                                                                                            | §9.2          | G16, P1, P2                 |
| G28 | The eight game-theory badges registered in the practice-layer registry _(cut candidate)_                                                                                    | §9.3          | P7, G16, G21, G22, G24, G26 |
| G29 | Content authoring: remaining tutorials, reason checks, sources, bot blurbs. Content work, guarded by the G8, G15 and G17 tests                                              | §6, §7        | G15, G17                    |

- **Status.** G23 and G28 are cut for v1 (above). Every other slice has landed on main. The deviations from this table are recorded in §14, items 12 to 14.
- **Pre-factor.** `docs/specs/game-theory-prefactor.md` (T1–T7) lands first. G7 becomes T1; the library, route and manifest parts of G1, the guards of G2, and the inert service surface of G9 move into T2, T3, T5 and T7. The practice-layer slices P1–P7 this table depends on have landed.
- **Parallel lanes after G2:** the solver (G3–G6), content (G7–G8, with G1), bots (G19), contests (G24's engine and G25).
- G11–G13 and G14 are independent of each other once G3–G5 land. G21, G22 and G23 are independent once G20 lands. G24 and G25 are independent.
- **v1 ships without G23 and G28.** Badges are cut: `contingent-winner` is the only one answerable from the games log, and the others need per-puzzle history that no §10 key stores.
- **Cut order for a smaller first drop:** G23, then G28; then G6 and G13; then the common-value half of G25 and G26; then the daily puzzle (G27); then reduce G18's map to a plain list.
- **Smallest meaningful drop:** G1–G5, G7–G12, G14–G17 (learn and practise). Bots and contests ship later.
- **Critical path:** content volume (18 concepts, 10 pairs, about 8 tutorials, about 15 reason checks) makes G29 likely the longest slice here.

## 14. Defaults and open questions

Author defaults, change before building:

1. A singleton route `/game-theory`, not `game-theory/:id`.
2. Library order 7 (after the three Confidence quizzes).
3. Widen five flash-card files (types only) rather than duplicate the card builder.
4. Soft gating: access is never locked; only difficulty and test-draw pools are gated.
5. The daily puzzle depends on the player's unlocked kinds, so it isn't the same puzzle for everyone.
6. Noise in human matches affects the bot only.
7. Real-world figures appear in the UI only with a source link (otherwise none).
8. No sync: clearing browser data loses progress, and travelling across timezones can break a practice streak.
9. Time pressure is out of scope for v1, because game theory needs reflection.
10. The daily plan has its own key, so `LearnState` stays at version 1 and an old build cannot zero tutorial stages.
11. The hub reset button (§10) is built in G18, because no slice owned it.
12. Name-the-bot names only the four bots with three or more confusable partners. The other four have no confusable set in §8.1, and G28 is cut, so no badge needs five names.
13. Test-out is a solo set on the puzzle or cards page (`?solo=…&mode=test`), not a page of its own. A test-out needs all three items, and a tutorial's Solo passes at two.
14. The bots reason check after a tournament is scored under `tit-for-tat`. The daily puzzle's reason check is information only, and its answer is kept with the day's record.

## 15. Sources

- Curriculum and misconceptions: Yale Open Courses ECON 159 (Polak) https://oyc.yale.edu/economics/econ-159 ; Stanford Encyclopedia of Philosophy, _Game Theory_ https://plato.stanford.edu/entries/game-theory/
- The Evolution of Trust (CC0): https://github.com/ncase/trust and https://ncase.me/trust/
- Axelrod tournaments and strategy library: https://axelrod.readthedocs.io/en/stable/ ; critique of tournament-dependence: https://jasss.soc.surrey.ac.uk/1/1/review1.html
- Beauty contest: https://en.wikipedia.org/wiki/Guess_2/3_of_the_average (cites Nagel 1995, _American Economic Review_ 85(5)); Politiken figures also in https://arxiv.org/pdf/2005.05154
- Winner's curse, Vickrey, game pages: https://en.wikipedia.org/wiki/Winner%27s_curse , https://en.wikipedia.org/wiki/Vickrey_auction , https://en.wikipedia.org/wiki/Prisoner%27s_dilemma , https://en.wikipedia.org/wiki/Stag_hunt , https://en.wikipedia.org/wiki/Chicken_(game)
- Game Theory Explorer (for cross-checking a solver): https://arxiv.org/pdf/1403.3969
- Debiasing games (the active ingredient was feedback plus practice, by the authors' interpretation): Morewedge et al. 2015 https://openaccess.city.ac.uk/12324
- Practice-layer evidence is in `practice-layer.md` §9.

Gaps: the Osborne and Rubinstein and Dixit and Nalebuff texts were not opened, and several curriculum rows (Bayesian games, signalling, mechanism design, Shapley value, public goods, the folk theorem) rest on standard textbook content that was not fetched. The Wikipedia pages are good for definitions but not authoritative for claims marked "citation needed". No published effectiveness study of The Evolution of Trust was found.
