# Confidence: Basic bank

Authoring rules for `items.json`. The quiz is described in `docs/specs/easier-quizzes.md` §3.

## Item shape

- `id`: `b` plus three digits (`b001`–`b160`). Ids are never reused, even after an item is removed.
- `prompt`: one question. Plain words; no trick phrasing.
- `options`: exactly two, each 1 to 4 words. `correct` is the index (0 or 1) of the right option.
- `topic`: one of `history`, `science`, `geography`, `nature`, `culture`, `numbers`.
- `level`: 1, 2 or 3. Never shown to the player.
  - 1: most adults know it.
  - 2: many adults know it, some will guess.
  - 3: close to a coin flip, but still answerable by searching.
- `fact`: one or two sentences stating the answer with the figure that settles it.
- `source`: `label` and `url`, pointing at a page that states the fact.

## Verification

Every item was checked before it was kept:

1. The fact was searched for, and the result had to state the answer. Items whose answer depended on a contested definition, a disputed measurement, or a source that did not state the fact were dropped.
2. The `url` came from the search results and is a page that states the fact.
3. Items that could not be confirmed were removed, not left in with a caveat.

This is a search-based check, not a read of each full page. The guard test checks shape only; it does not check truth. Any item whose fact changes (for example, a population or height figure) must be re-checked and its `fact` updated.

## Levels

Levels were set by the author, not by a panel of reviewers, and they have not been measured against real player answers. Level 1 items are the easiest, so they should be answered correctly most often. If real answers show otherwise, change the level and say so in the commit.

## Guard

`src/app/features/calibration/calibration-basic-bank.spec.ts` checks ids, levels, option length, fact and source fields, and the minimum count per topic: 10 level-1, 10 level-2 and 4 level-3 items. A topic that falls below these counts fails the build.
