import type { PuzzleKind, ReasonCheck } from '../../lib/puzzle.types';

/**
 * The reason check to ask after a puzzle item (spec §5.3). It is the first check whose context is
 * the item's kind and whose concept the item credits. Null when no check matches, so the page asks
 * nothing and says nothing about it.
 */
export function reasonCheckFor(
  checks: readonly ReasonCheck[],
  kind: PuzzleKind,
  conceptIds: readonly string[],
): ReasonCheck | null {
  return (
    checks.find((check) => check.context === kind && conceptIds.includes(check.conceptId)) ?? null
  );
}
