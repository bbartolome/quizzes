import {
  Template,
  Concept,
  ConfusedPair,
  Question,
  RoundQuestion,
} from '../../core/models/quiz.models';
import type { QuestionBank, SelectRoundOptions } from '../../core/services/quiz-engine.service';

export interface RoundFilters {
  categories?: readonly ('fallacy' | 'bias')[];
  traitIds?: string[];
  weakTraits: boolean;
}

export function parseRoundFilters(q: {
  cat: string | null;
  traits: string | null;
  weakTraits: string | null;
}): RoundFilters {
  let categories: ('fallacy' | 'bias')[] | undefined;
  if (q.cat === 'fallacy' || q.cat === 'bias') {
    categories = [q.cat];
  }

  let traitIds: string[] | undefined;
  if (q.traits) {
    const parsed = q.traits
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    traitIds = parsed.length > 0 ? parsed : undefined;
  }

  return {
    categories,
    traitIds,
    weakTraits: q.weakTraits === 'true',
  };
}

export function weakTraitWeights(weakIds: string[]): Record<string, number> {
  const weights: Record<string, number> = {};
  const len = weakIds.length;
  for (let i = 0; i < len; i++) {
    weights[weakIds[i]] = len - i;
  }
  return weights;
}

export function pickTemplate(
  templates: Template[],
  kb: Concept[],
  f: RoundFilters,
  rng: () => number = Math.random,
): Template | undefined {
  let matched = templates;

  if (f.categories) {
    const cats = new Set(f.categories);
    matched = matched.filter((t) => cats.has(t.category));
  }

  if (f.traitIds && f.traitIds.length > 0) {
    const wanted = new Set(f.traitIds);
    const names = new Set(
      kb.filter((entry) => wanted.has(entry.id)).map((entry) => entry.name.toLowerCase()),
    );
    matched = matched.filter((t) => t.correctAnswers.some((a) => names.has(a.toLowerCase())));
  }

  if (matched.length === 0) {
    return undefined;
  }

  return matched[Math.floor(rng() * matched.length)];
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function traitIdsForAnswers(correctAnswers: string[], kb: Concept[]): string[] {
  const nameToId = new Map<string, string>();
  for (const entry of kb) {
    nameToId.set(entry.name.toLowerCase(), entry.id);
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const answer of correctAnswers) {
    const id = nameToId.get(answer.toLowerCase());
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

export const TEMPLATE_PROBABILITY = 0.25;

export const NO_TRAP = 'No trap \u2014 sound reasoning';

/** Most options an easy-mode question shows; correct answers are never dropped. */
export const EASY_MAX_OPTIONS = 5;

/**
 * Easy start: on while the player has never finished a round, has answered fewer than 8
 * questions this round, and has not yet reached 4 answers at 70% or better.
 */
export function isEasyMode(p: {
  roundsPlayed: number;
  answered: number;
  correct: number;
}): boolean {
  if (p.roundsPlayed > 0 || p.answered >= 8) return false;
  if (p.answered >= 4 && p.correct / p.answered >= 0.7) return false;
  return true;
}

/**
 * A shorter option list for an easy-mode question. Keeps every correct answer, then
 * fills up to EASY_MAX_OPTIONS with confused-pair partners of the correct answers first,
 * then random other options. Shuffled. Pure: the question is not mutated.
 * rng draws: one shuffle of the remaining candidates, then one shuffle of the result.
 */
export function trimOptions(
  question: Pick<RoundQuestion, 'options' | 'correctAnswers'>,
  kb: Concept[],
  pairs: ConfusedPair[],
  rng: () => number,
): string[] {
  const correct = [...question.correctAnswers];
  const correctSet = new Set(correct);
  const nameById = new Map(kb.map((c) => [c.id, c.name]));
  const offered = new Set(question.options);

  const partners: string[] = [];
  for (const pair of pairs) {
    const [a, b] = pair.concepts.map((id) => nameById.get(id) ?? id);
    for (const [mine, theirs] of [
      [a, b],
      [b, a],
    ]) {
      if (correctSet.has(mine) && !correctSet.has(theirs) && offered.has(theirs)) {
        if (!partners.includes(theirs)) partners.push(theirs);
      }
    }
  }

  const room = Math.max(0, EASY_MAX_OPTIONS - correct.length);
  const others = shuffle(
    question.options.filter((o) => !correctSet.has(o) && !partners.includes(o)),
    rng,
  );
  const distractors = [...partners, ...others].slice(0, room);
  return shuffle([...correct, ...distractors], rng);
}

export interface NextQuestionDeps {
  questions: Question[];
  templates: Template[];
  kb: Concept[];
  /** Easy start: draw from difficulty-1 questions and trim their options. */
  easy?: boolean;
  pairs?: ConfusedPair[];
  filters: RoundFilters;
  usedIds: ReadonlySet<string>;
  weights?: Record<string, number>;
  selectRound: (bank: QuestionBank, options: SelectRoundOptions) => RoundQuestion[];
  renderTemplate: (tpl: Template, traitIds: string[]) => RoundQuestion;
  serial: number;
  rng?: () => number;
}

export function nextQuestion(d: NextQuestionDeps): RoundQuestion | undefined {
  const rng = d.rng ?? Math.random;

  const easy = d.easy === true;
  const fixed = d.selectRound(
    { questions: easy ? d.questions.filter((q) => q.difficulty === 1) : d.questions },
    {
      count: 1,
      categories: d.filters.categories ? [...d.filters.categories] : undefined,
      traitIds: d.filters.traitIds,
      avoidIds: new Set(d.usedIds),
      weakTraitWeights: d.weights,
    },
  )[0];

  if (!fixed || d.usedIds.has(fixed.id)) {
    return undefined;
  }

  if (rng() < TEMPLATE_PROBABILITY) {
    const tpl = pickTemplate(d.templates, d.kb, d.filters, rng);
    if (tpl) {
      const rendered = d.renderTemplate(tpl, traitIdsForAnswers(tpl.correctAnswers, d.kb));
      return {
        ...rendered,
        id: `${tpl.id}#${d.serial}`,
        sourceTemplateId: tpl.id,
      };
    }
  }

  return easy ? { ...fixed, options: trimOptions(fixed, d.kb, d.pairs ?? [], rng) } : fixed;
}

export function kbByName(kb: Concept[]): Map<string, Concept> {
  return new Map(kb.map((e) => [e.name.toLowerCase(), e]));
}
