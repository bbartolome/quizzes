import type { ReasonCheck } from './puzzle.types';

/**
 * The reason check to ask after a puzzle item (spec §5.3). It is the first check whose context is
 * the item's kind and whose concept the item credits. Null when no check matches, so the page asks
 * nothing and says nothing about it.
 */
export function reasonCheckFor(
  checks: readonly ReasonCheck[],
  context: ReasonCheck['context'],
  conceptIds: readonly string[],
): ReasonCheck | null {
  return (
    checks.find((check) => check.context === context && conceptIds.includes(check.conceptId)) ?? null
  );
}
