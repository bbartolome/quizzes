import { QuizStats, KnowledgeBaseEntry } from '../../core/models/quiz.models';

export interface TraitRow {
  id: string;
  name: string;
  correct: number;
  attempted: number;
  accuracy: number;
}

export function traitRows(stats: QuizStats, kb: KnowledgeBaseEntry[]): TraitRow[] {
  const nameById = new Map<string, string>(kb.map((entry) => [entry.id, entry.name]));

  const rows: TraitRow[] = Object.entries(stats.perTrait)
    .filter(([, perTrait]) => perTrait.attempted > 0)
    .map(([id, perTrait]) => {
      const accuracy = Math.round((perTrait.correct / perTrait.attempted) * 100);
      return {
        id,
        name: nameById.get(id) ?? id,
        correct: perTrait.correct,
        attempted: perTrait.attempted,
        accuracy,
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
