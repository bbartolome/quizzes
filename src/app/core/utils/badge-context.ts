import type { BadgeContext, MasteryState, PracticeState } from '../models/practice.models';
import type { Concept, ConfusedPair, QuizStats } from '../models/quiz.models';
import { CROSS_QUIZ_BADGES, earnedBadges } from './badges';
import { pooledConceptCounts } from './concept-counts';
import { daysFor, masteryOf } from './mastery';

/** Everything the cross-quiz badges read, as plain data. The feature layer gathers it (practice-layer.md §8). */
export interface BadgeSource {
  /** The shared knowledge base concepts. Their ids define the mastery map. */
  concepts: readonly Concept[];
  pairs: readonly ConfusedPair[];
  /** Stats records of the three practice quizzes (Reasoning Traps, Biases, Fallacies). */
  stats: readonly QuizStats[];
  conceptDays: PracticeState['conceptDays'];
  /** Lifetime Confidence answers across every calibration quiz, each with its format. */
  calibration: BadgeContext['calibration'];
}

/** Builds the BadgeContext. Pure: mastery is evaluated once, here, never per answer. */
export function buildBadgeContext(source: BadgeSource): BadgeContext {
  const validIds = new Set(source.concepts.map((c) => c.id));
  const pooled = pooledConceptCounts(source.stats, validIds);
  const mastery = new Map<string, MasteryState>();
  for (const id of validIds) {
    const row = pooled.get(id) ?? { attempted: 0, correct: 0 };
    mastery.set(
      id,
      masteryOf({
        attempted: row.attempted,
        correct: row.correct,
        days: daysFor(source.conceptDays[id], row.attempted),
      }),
    );
  }
  return { mastery, pairs: source.pairs, calibration: source.calibration, extra: {} };
}

function isPractised(state: MasteryState | undefined): boolean {
  return state === 'practised' || state === 'mastered';
}

/** One-line evidence for a badge that is earned in `ctx`. */
function evidenceFor(id: string, ctx: BadgeContext, names: ReadonlyMap<string, string>): string {
  const name = (conceptId: string) => names.get(conceptId) ?? conceptId;
  switch (id) {
    case 'notices-lookalikes': {
      const pair = ctx.pairs.find((p) => p.concepts.every((c) => isPractised(ctx.mastery.get(c))));
      return pair
        ? `${name(pair.concepts[0])} and ${name(pair.concepts[1])} are both practised`
        : 'Both concepts of a confused pair are practised';
    }
    case 'names-the-trap': {
      let practised = 0;
      for (const state of ctx.mastery.values()) {
        if (isPractised(state)) practised++;
      }
      return `${practised} of ${ctx.mastery.size} concepts practised`;
    }
    case 'knows-what-it-knows':
      return `${ctx.calibration.length} lifetime Confidence answers compared by confidence`;
    case 'sure-means-sure': {
      const sure = ctx.calibration.filter((c) => c.confidence >= 90);
      const hits = sure.filter((c) => c.correct).length;
      return `${hits} of ${sure.length} answers at 90% confidence or more were right`;
    }
    default:
      return id;
  }
}

/**
 * The badges that are earned now and not yet stored, with their evidence.
 * `already` is the stored badges map; a stored badge is never reported again.
 */
export function badgesToRecord(
  source: BadgeSource,
  already: Readonly<Record<string, unknown>>,
): { id: string; evidence: string }[] {
  const ctx = buildBadgeContext(source);
  const names = new Map(source.concepts.map((c) => [c.id, c.name] as const));
  return earnedBadges(CROSS_QUIZ_BADGES, ctx)
    .filter((id) => !Object.prototype.hasOwnProperty.call(already, id))
    .map((id) => ({ id, evidence: evidenceFor(id, ctx, names) }));
}
