# Concepts knowledge base

`knowledge-base.json` is the shared knowledge base for the Reasoning Traps, Biases and Fallacies quizzes. It is `{ concepts, pairs }`:

- `concepts`: one entry per bias or fallacy. `spottingTip` is optional.
- `pairs`: confused pairs, unordered, each `{ concepts: [idA, idB], tip? }`. The pair tip names both sides.

Authoring rules:

- Concept ids are unique. Pairs reference existing ids, have no self-pairs, and never repeat in either order. The guard tests in `src/app/core/services/knowledge-base.spec.ts` enforce this.
- Any edit to this file (concepts or pairs) must bump the `version` of every manifest entry that reads it in `public/data/quizzes.json`: Reasoning Traps, and later Biases and Fallacies. Stored stats migrate on that version (`StatsService.migrateVersion`), so a missing bump leaves old stats in place.
