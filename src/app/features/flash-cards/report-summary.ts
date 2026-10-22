/** One checked card of a flash card round: its target, the concept picked, and whether it was right. */
export interface ReportResult {
  targetId: string;
  pickedId: string;
  correct: boolean;
}

/** A wrong card as shown on the report: "<target> — you picked <lure>". */
export interface MissedLine {
  targetName: string;
  lureName: string;
}

export interface ReportSummary {
  n: number;
  m: number;
  missed: MissedLine[];
}

export const BACK_LABELS: Record<'bias' | 'fallacy', string> = {
  bias: 'Back to Biases',
  fallacy: 'Back to Fallacies',
};

/**
 * Builds the report from one round's results. Only wrong cards are listed; a repeated
 * (target, lure) pair appears once, at its first miss. Ids missing from `names` show as-is.
 */
export function buildReportSummary(
  results: ReportResult[],
  names: Map<string, string>,
): ReportSummary {
  const seen = new Set<string>();
  const missed: MissedLine[] = [];
  for (const r of results) {
    if (r.correct) {
      continue;
    }
    const key = JSON.stringify([r.targetId, r.pickedId]);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    missed.push({
      targetName: names.get(r.targetId) ?? r.targetId,
      lureName: names.get(r.pickedId) ?? r.pickedId,
    });
  }
  return {
    n: results.filter((r) => r.correct).length,
    m: results.length,
    missed,
  };
}

/** True when there is nothing to report: no card was checked, or history state was lost on reload. */
export function isReportEmpty(results: ReportResult[]): boolean {
  return results.length === 0;
}
