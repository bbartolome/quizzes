import { QuizStats, Concept } from '../../core/models/quiz.models';
import { MasteryState, PracticeState } from '../../core/models/practice.models';
import { daysFor, masteryOf } from '../../core/utils/mastery';

export interface TraitRow {
  id: string;
  name: string;
  correct: number;
  attempted: number;
  accuracy: number;
  mastery: MasteryState;
}

/** Glyph and word for each mastery state. Colour is never the only signal (practice-layer.md §11). */
export const MASTERY_LOOK: Record<MasteryState, { glyph: string; label: string }> = {
  new: { glyph: '○', label: 'New' },
  learning: { glyph: '◔', label: 'Learning' },
  practised: { glyph: '◑', label: 'Practised' },
  mastered: { glyph: '●', label: 'Mastered' },
};

export function traitRows(
  stats: QuizStats,
  kb: Concept[],
  conceptDays: PracticeState['conceptDays'] = {},
): TraitRow[] {
  const nameById = new Map<string, string>(kb.map((entry) => [entry.id, entry.name]));

  const rows: TraitRow[] = Object.entries(stats.perTrait)
    .filter(([, perTrait]) => perTrait.attempted > 0)
    .map(([id, perTrait]) => {
      const baseRow = {
        id,
        name: nameById.get(id) ?? id,
        correct: perTrait.correct,
        attempted: perTrait.attempted,
        accuracy: Math.round((perTrait.correct / perTrait.attempted) * 100),
      };
      return {
        ...baseRow,
        mastery: masteryOf({
          attempted: perTrait.attempted,
          correct: perTrait.correct,
          days: daysFor(conceptDays[id], perTrait.attempted),
        }),
      };
    });

  return rows.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return a.name.localeCompare(b.name);
  });
}

export function overallAccuracy(stats: QuizStats): number {
  const perTrait = Object.values(stats.perTrait);
  const totalAttempted = perTrait.reduce((sum, entry) => sum + entry.attempted, 0);
  if (totalAttempted === 0) return 0;

  const totalCorrect = perTrait.reduce((sum, entry) => sum + entry.correct, 0);
  return Math.round((totalCorrect / totalAttempted) * 100);
}
