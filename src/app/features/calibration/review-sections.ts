import {
  type AnswerFlag,
  type CalibrationAnswer,
  type CalibrationBank,
  type CalibrationFormat,
  type CalibrationItem,
  type ItemSource,
  type ReviewGroup,
  isFourWayItem,
} from './calibration.models';
import { correctPick, pickLabel } from './pick-label';
import { flags, reviewGroup } from './scoring';

export interface ReviewRow {
  itemId: string;
  prompt: string;
  confidence: number;
  pickLabel: string;
  correctLabel: string | null;
  facts: string[];
  source: ItemSource;
  flags: AnswerFlag[];
}

export interface ReviewSection {
  group: ReviewGroup;
  title: string;
  open: boolean;
  rows: ReviewRow[];
}

const GROUPS: ReadonlyArray<readonly [ReviewGroup, string, boolean]> = [
  ['confident-miss', 'Confident misses', true],
  ['hedged-miss', 'Hedged misses', true],
  ['underplayed-hit', 'Underplayed hits', false],
  ['confident-hit', 'Confident hits', false],
];

export function reviewRow(
  item: CalibrationItem,
  answer: CalibrationAnswer,
  format: CalibrationFormat,
): ReviewRow {
  return {
    itemId: item.id,
    prompt: item.prompt,
    confidence: answer.confidence,
    pickLabel: pickLabel(item, answer.pick),
    correctLabel: answer.correct ? null : pickLabel(item, correctPick(item)),
    facts: isFourWayItem(item) ? [...item.facts] : [item.fact],
    source: item.source,
    flags: flags(answer, format),
  };
}

export function reviewSections(
  bank: CalibrationBank,
  answers: CalibrationAnswer[],
  format: CalibrationFormat,
): ReviewSection[] {
  const byId = new Map<string, CalibrationItem>();
  for (const item of bank.items) byId.set(item.id, item);

  const rowsByGroup = new Map<ReviewGroup, ReviewRow[]>();
  for (const answer of answers) {
    const item = byId.get(answer.itemId);
    if (!item) continue;
    const group = reviewGroup(answer, format);
    const rows = rowsByGroup.get(group) ?? [];
    rows.push(reviewRow(item, answer, format));
    rowsByGroup.set(group, rows);
  }

  const sections: ReviewSection[] = [];
  for (const [group, title, open] of GROUPS) {
    const rows = rowsByGroup.get(group);
    if (rows && rows.length > 0) sections.push({ group, title, open, rows });
  }
  return sections;
}
