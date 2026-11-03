# Game theory content

The game-theory quiz reads three files from this folder:

- `concepts.json`: `{ version, concepts, pairs }`. `concepts` holds one entry per game-theory concept. `pairs` holds confused pairs, as in the knowledge base.
- `tutorials.json`: `{ version, tutorials }`. `tutorials` holds one three-stage script per concept that has an interactive mode.
- `checks.json`: `{ version, checks }`. `checks` holds the reason checks, each with one correct option and at least one option that targets a named misconception.

Authoring rules:

- Editing any of the three files bumps the game-theory entry's `version` in `public/data/quizzes.json`. The `version` inside each file must equal that manifest value. `content-version.spec.ts` enforces this.
- Concept ids are never reused. A removed concept keeps its id retired, so stored progress for it can be pruned safely.
- Concept ids are kebab-case and disjoint from the knowledge-base ids. Every prerequisite must exist, and there must be no cycle.
- Marks in tutorial annotations come from the solver, never from authored text. A guard checks every annotated game.
- Any numeric empirical claim carries a `source` link.

The per-file guards are added with their content: `concepts.guard.spec.ts`, `checks.guard.spec.ts` and `tutorials.guard.spec.ts`. See `docs/specs/game-theory.md` §6.5 for the full list.
