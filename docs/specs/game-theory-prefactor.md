# Spec: Game theory pre-factor

Pre-factoring that lets `docs/specs/game-theory.md` be implemented in parallel lanes. It is documentation: each T step is implemented separately, in the TDD style the game-theory spec uses. It follows the shape of `docs/specs/practice-layer-prefactor.md`.

## Context

The slice table (§13 of the game-theory spec) lists a parallel-lanes note, but several things stop the lanes from running at once:

1. **No shared contract.** Every lane consumes types and services that only exist once an upstream slice lands: `Rng`, `PayoffMatrix`, `Puzzle`, `ReasonCheck` (§4–5), `GameTheoryConcept` (§6.1), and `GtEvidenceService` and `GtLearnService` (G9). G10, G16, G17, G20, G21, G24 and G26 all call the last two.
2. **Hotspot files that many slices edit.**
   - `app.routes.spec.ts` hard-codes a route count (`toBe(18)`), and §3.2 bumps it in seven slices (19, 20, 21, 22, 23, 24, 25). Seven lanes would conflict on one number.
   - `app.routes.ts` is touched by G1, G10, G16, G17, G20, G24 and G27.
   - `library-cards.ts` (`ROUTE_PREFIX`, `routeFor`, `conceptIdsFor`), `library-page.ts` (`toCard`) and the `kind` union in `quiz.models.ts` are all edited by G1. Adding `'game-theory'` to the union breaks the exhaustive `Record<kind, string>`, so the change has to land in one piece.
   - The hub page (G1, G18, G20, G22, G27) and the `play/:game` page (G24, then G26 re-edits it).
   - `concepts.json`, `tutorials.json` and `checks.json` are edited by G8, G15, G17 and G29, and each has a version guard.
3. **Behaviour-preserving work inside a feature slice.** G7 widens five shared flash-card and glossary files and changes no game-theory behaviour. It should land before anyone builds on `buildCard`.
4. **Test scaffolding that every solver and generator slice would duplicate.** Seed loops over 0–499, scripted rng, canonical fixture games and a brute-force reference solver are needed by G3, G4, G5, G11, G12, G13 and the tutorial guard.
5. **Stale references in the spec.** The practice-layer pre-factor has landed, so `routeFor` and `ROUTE_PREFIX` live in `features/library/library-cards.ts`, not `library-page.ts`. `PracticeService`, `src/testing/*`, `dates`, `mastery`, `badges` and `concept-counts` already exist, so G9's dependency on P2 and P4 and G28's on P7 are met by code that has landed.

The pre-factor below doesn't change behaviour. Each step is a small commit on its own branch. After it lands, the lanes below can run at once.

## Pre-factor steps

T1 has no dependencies and should merge first. T2 comes next. T3–T7 are independent of each other and can run in any order or in parallel once T2 has landed.

### T1. Widen the card cores (G7, promoted)

Land `CardConcept`, `ConceptSet<C>`, generic `buildCard` and `FlashCard`, `pickTarget`/`drawTarget`/`applyBump`, `buildFeedback`, and `confusedWith`/`pairTip`, exactly as §6.1 describes. Existing specs pass unchanged. G7 leaves the slice table. Merge it first, because the easier-quizzes work also edits `card-builder.ts`.

### T2. Game-theory contract: types, tokens, inert services

This step unblocks every consumer lane. It contains no logic that G2–G6, G9 or G19 will test.

- `core/models/quiz.models.ts`: add `'game-theory'` to the `kind` union; add `GameTheoryConcept` and `GameTheoryContent`. They extend `CardConcept` from T1.
- `features/library/library-cards.ts`: add `'game-theory': '/game-theory'` to `ROUTE_PREFIX`, a singleton case in `routeFor` (returns `/game-theory`, no `:id`), and a `conceptIdsFor` arm so the code still compiles. Add `gameTheoryCard(entry, learnSummary, dailyOpen)` as an inert stub that returns zeros. Pin it with a `library-cards.spec.ts` case. This is the one library edit G1 would otherwise make.
- `features/game-theory/lib/*.types.ts`: type-only files copied verbatim from the spec. `rng` (`Rng` only), `matrix` (§5.1), `puzzle` (§5.2 plus `ReasonCheck` and `MisconceptionId`), `bots` (§8.1), `beauty` and `auctions` (§8.2–8.3), `tutorial` (§7.1), `state` (`LearnState`, `GamesLog`, `GameKind` and the rest of §10). Lanes import types, not implementations.
- `features/game-theory/state/gt-tokens.ts`: `GAME_THEORY_RNG` (§4.1).
- `features/game-theory/state/gt-evidence.service.ts`, `gt-learn.service.ts`, `gt-games.service.ts`: the full public surface from §9.1 and §10, root-provided, with inert bodies (`record` is a no-op; reads return zeroed state). G9, G20 and G24 replace the bodies and keep the signatures.
- `src/testing/fake-gt-evidence.service.ts` and `fake-gt-learn.service.ts`: in-memory fakes that record calls (`records: { conceptIds, correct, facet }[]`) and let a spec seed introduced concepts. Every page lane mocks against these.

### T3. Guards first: purity and boundaries

`lib/purity.spec.ts` and `game-theory-boundaries.spec.ts` (§3.3, §4.2) land with an empty `lib/` and one placeholder page. Every lane then inherits them from its first commit, instead of finding violations at merge time. The rng itself (`hashSeed`, `mulberry32`) stays in G2.

### T4. Shared test kit in `src/testing/`

- `seeds.ts`: `forSeeds(n = 500, fn)` and `scripted(...values): Rng`.
- `gt-fixtures.ts`: the five canonical classification games (§5.1 table) as `PayoffMatrix` fixtures, plus the 8-symmetry relabel helper. G5, G12, G17 and the tutorial guard share them.
- `brute-force-nash.ts`: the reference solver G3 compares against, reused by G11, G12 and G13 for their "satisfies spec" property tests.
- `tsconfig.app.json` already excludes `src/testing/**`; no change is needed.

### T5. Route table split

- `features/game-theory/game-theory.routes.ts` exports `GAME_THEORY_ROUTES: Routes`. T5 registers the hub path (`''`); each later slice appends its own row to this file.
- `app.routes.ts` gains one `{ path: 'game-theory', children: GAME_THEORY_ROUTES }` entry, added once. The top-level count goes 18 → 19 in T5 and never changes again.
- `app.routes.spec.ts` asserts 19. A new `game-theory.routes.spec.ts` asserts the game-theory table, so each slice edits only its own row there.
- The hub paths stay `game-theory`, `game-theory/cards`, and so on.

### T6. Hub and `play/:game` as dispatchers

- `pages/home/`: the hub renders a plain `GAME_THEORY_MODES` array (`features/game-theory/modes.ts`, entries `{ id, title, path, requires }`) and three named slots in the template, each with a one-line comment: _map_ (G18), _modes_ (the array: G10, G16, G20 and G24 each append one entry) and _today/daily_ (G27). Each lane owns one slot or one array line.
- `pages/play/`: `PlayPage` reads `:game` and picks a component from a `PLAY_GAMES` map in `play-games.ts`. G24 adds `beauty-contest`; G26 adds the three auction entries. There is no shared template.
- Both ship with placeholder components so the routes resolve.

### T7. Content skeleton, manifest entry and loader

- Seed `public/data/quizzes/game-theory/{concepts,tutorials,checks}.json` with `{ "version": 1 }` and empty arrays, plus the `README.md` from §6.5.
- Add the `game-theory` entry to `public/data/quizzes.json` (order 7, version 1, `icon: icons/game-theory.svg`, `dataPath: data/quizzes/game-theory/`) and the SVG icon.
- `data/game-theory-data.service.ts` loads all three files together with one Retry state. G8, G15 and G17 each fill their own file and leave the service alone.
- `content-version.spec.ts` holds the version-equality guard from §6.5 and passes on the seed files. Split the other §6.5 guards by file: `concepts.guard.spec.ts` (G8), `checks.guard.spec.ts` (G15), `tutorials.guard.spec.ts` (G17). Lanes never share a spec.
- Confirm that the GLOSSARY "Game theory" section covers every term the spec uses, and add what is missing now, so no lane edits `GLOSSARY.md`.

## Lanes after the pre-factor

G1 shrinks to "the hub renders `GAME_THEORY_MODES`, and the library card shows real summary numbers". Its library, route and manifest work moved to T2, T5 and T7.

| Lane                | Slices                                 | Depends on                 | Files owned                                               |
| ------------------- | -------------------------------------- | -------------------------- | --------------------------------------------------------- |
| A Solver            | G3, then G4, G5 and G6 in parallel     | T2–T4                      | `lib/matrix`, `dominance`, `classify`, `mixed`            |
| B Rng               | G2 (`hashSeed`, `mulberry32`)          | T2, T3                     | `lib/rng.ts`                                              |
| C Content           | G8 `concepts.json`, G15 `checks.json`  | T1, T2, T7                 | the JSON files and their guard specs                      |
| D State bodies      | G9                                     | T2 (practice layer landed) | the three `state/` services                               |
| E Generators        | G11, G12, G13 in parallel              | A                          | `lib/puzzles/*`                                           |
| F Widget            | G14 `PayoffMatrix`                     | T2, T4                     | `ui/payoff-matrix`                                        |
| G Bots, pure        | G19                                    | T2, B                      | `lib/bots`, `match`                                       |
| H Contests, pure    | G24 engine, G25 in parallel            | T2, B                      | `lib/beauty`, `lib/auctions`                              |
| Pages (second wave) | G10, G16, G17, G20, G24 page, G26, G27 | their pure lane and fakes  | one page directory, one array line and one route row each |
| Wave 3              | G18, G21–G23, G28, G29                 | pages                      | —                                                         |

The page lanes depend on the pure lane they render and on the fakes from T2, not on lane D's real bodies. Lane D replaces method bodies only, so it never conflicts with them.

## Merge order

T1 → T2 → (T3, T4, T5, T6, T7 in any order) → lanes in any order.

## Corrections to `game-theory.md`

Made in the same commit as this spec:

- §3.1: `routeFor` and `ROUTE_PREFIX` are in `features/library/library-cards.ts`.
- §3.2: the 18 → 25 route-count table is replaced by the child-route table (T5).
- §13: G7 becomes T1; G1, G2 and G9 are trimmed as above; the practice-layer dependencies are marked as landed.

## Critical files

- Edit: `src/app/core/models/quiz.models.ts`, `src/app/features/library/library-cards.ts` (and its spec), `src/app/app.routes.ts`, `src/app/app.routes.spec.ts`, `public/data/quizzes.json`, `GLOSSARY.md` (if terms are missing).
- T1: `flash-cards/card-builder.ts`, `draw-weights.ts`, `feedback.ts`, `glossary/glossary-search.ts`.
- New: `src/app/features/game-theory/**` (types, tokens, inert services, routes, modes, play map, placeholder pages), `src/testing/{seeds,gt-fixtures,brute-force-nash,fake-gt-evidence.service,fake-gt-learn.service}.ts`, `public/data/quizzes/game-theory/*`.
- Reuse: the `CALIBRATION_RNG` token pattern (`calibration/draw.ts`), `FakePracticeService` and `provideFixedClock` (`src/testing/`), the `bank-version.spec.ts` pattern for content guards, and the landed `PracticeService`, `masteryOf` and `earnedBadges`.

## Verification

- After each T step: `rm -rf node_modules/.vitest-cache && npx ng test --watch=false`. The whole suite passes, and `library-page.spec.ts`, `design-system.spec.ts` and `flash-cards/*.spec.ts` pass unchanged.
- `npx ng build` succeeds, and `src/testing/` stays out of the app bundle.
- `app.routes.spec.ts` counts 19 routes after T5.
- Manual check: the library shows a Game Theory card linking to `#/game-theory`, which renders the hub placeholder. All other cards render as before.
