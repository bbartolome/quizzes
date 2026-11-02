import { QuizStats } from '../models/quiz.models';

/**
 * Attempted and correct per concept, summed across the given stats records (practice-layer.md §6).
 * Ids not in validIds are dropped (for example the sound-reasoning pseudo-trait).
 * Does not replace pooledCounts in features/flash-cards/draw-weights.ts.
 */
export function pooledConceptCounts(
  records: readonly QuizStats[],
  validIds: ReadonlySet<string>,
): Map<string, { attempted: number; correct: number }> {
  const pooled = new Map<string, { attempted: number; correct: number }>();
  for (const record of records) {
    for (const [id, row] of Object.entries(record.perTrait)) {
      if (!validIds.has(id)) {
        continue;
      }
      const sum = pooled.get(id) ?? { attempted: 0, correct: 0 };
      pooled.set(id, {
        attempted: sum.attempted + row.attempted,
        correct: sum.correct + row.correct,
      });
    }
  }
  return pooled;
}
