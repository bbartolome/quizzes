import { CardConcept, ConceptSet, QuizStats } from '../../core/models/quiz.models';
import { confusedWith } from '../glossary/glossary-search';

const MAX_WEIGHT = 3;

/** Per deck concept: correct and attempted summed over stats:reasoning-traps and stats:<kind>. Missing in both = 0/0. Non-deck keys ignored. */
export function pooledCounts(
  deck: readonly CardConcept[],
  trapsStats: QuizStats,
  kindStats: QuizStats,
): Map<string, { correct: number; attempted: number }> {
  const pooled = new Map<string, { correct: number; attempted: number }>();
  for (const concept of deck) {
    const traps = trapsStats.perTrait[concept.id];
    const kind = kindStats.perTrait[concept.id];
    pooled.set(concept.id, {
      correct: (traps?.correct ?? 0) + (kind?.correct ?? 0),
      attempted: (traps?.attempted ?? 0) + (kind?.attempted ?? 0),
    });
  }
  return pooled;
}

/** 1 + 2 * (1 - p), p = (correct + 0.5) / (attempted + 1). 0/0 gives 2. */
export function drawWeight(correct: number, attempted: number): number {
  const p = (correct + 0.5) / (attempted + 1);
  return 1 + 2 * (1 - p);
}

/** Base weight per deck concept id, computed once at round start. */
export function baseWeights(
  deck: readonly CardConcept[],
  trapsStats: QuizStats,
  kindStats: QuizStats,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const [id, counts] of pooledCounts(deck, trapsStats, kindStats)) {
    weights.set(id, drawWeight(counts.correct, counts.attempted));
  }
  return weights;
}

/** deck minus previousTarget, in deck order. If that is empty, returns the full deck (DECISION). */
export function candidates<C extends CardConcept>(
  deck: readonly C[],
  previousTarget: C | null,
): readonly C[] {
  const filtered = deck.filter((concept) => concept.id !== previousTarget?.id);
  return filtered.length > 0 ? filtered : deck;
}

/** min(baseWeight + (bumped ? 1 : 0), 3). */
export function effectiveWeight(baseWeight: number, bumped: boolean): number {
  return Math.min(baseWeight + (bumped ? 1 : 0), MAX_WEIGHT);
}

/** Weighted pick over pool using weights (same length, pool order). Exactly one rng() call. */
export function pickTarget<C extends CardConcept>(
  pool: readonly C[],
  weights: readonly number[],
  rng: () => number,
): C {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const r = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < pool.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) {
      return pool[i];
    }
  }
  // Floating-point guard: fall through to the last element.
  return pool[pool.length - 1];
}

/** Main entry point for S6. candidates -> effective weights from baseWeightMap and bumpedIds -> pickTarget. */
export function drawTarget<C extends CardConcept>(
  deck: readonly C[],
  previousTarget: C | null,
  baseWeightMap: Map<string, number>,
  bumpedIds: ReadonlySet<string>,
  rng: () => number,
): C {
  const pool = candidates(deck, previousTarget);
  const weights = pool.map((concept) => {
    const base = baseWeightMap.get(concept.id);
    if (base === undefined) {
      throw new Error(`No base draw weight for concept "${concept.id}"`);
    }
    return effectiveWeight(base, bumpedIds.has(concept.id));
  });
  return pickTarget(pool, weights, rng);
}

/** Returns a new Set. Adds picked.id when picked is a confused partner of target (confusedWith(target, kb)). Does not mutate bumpedIds. Caller decides that the pick was wrong. */
export function applyBump<C extends CardConcept>(
  bumpedIds: ReadonlySet<string>,
  target: C,
  picked: C,
  kb: ConceptSet<C>,
): ReadonlySet<string> {
  const next = new Set(bumpedIds);
  if (confusedWith(target, kb).some((partner) => partner.id === picked.id)) {
    next.add(picked.id);
  }
  return next;
}
