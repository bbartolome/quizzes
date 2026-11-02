import { describe, expect, it } from 'vitest';
import { Concept, ConfusedPair, QuizStats } from '../models/quiz.models';
import { PracticeState } from '../models/practice.models';
import { badgesToRecord, buildBadgeContext, BadgeSource } from './badge-context';

const concept = (id: string, name = id): Concept => ({
  id,
  name,
  type: 'bias',
  shortDefinition: `short ${id}`,
  longExplanation: `long ${id}`,
  example: `example ${id}`,
});

const stats = (
  quizId: string,
  rows: Record<string, { attempted: number; correct: number }>,
): QuizStats => ({
  quizId,
  version: 1,
  streak: 0,
  roundsPlayed: 0,
  perTrait: Object.fromEntries(
    Object.entries(rows).map(([traitId, row]) => [traitId, { traitId, ...row }]),
  ),
});

const days = (n: number): PracticeState['conceptDays'][string] => ({
  days: n,
  lastDay: '2026-11-01',
});

/** Sixteen concepts, the first `practised` of them with ten right answers over two days. */
function sixteen(practised: number): { concepts: Concept[]; source: Partial<BadgeSource> } {
  const concepts = Array.from({ length: 16 }, (_, i) => concept(`c${i}`));
  const rows: Record<string, { attempted: number; correct: number }> = {};
  const conceptDays: PracticeState['conceptDays'] = {};
  for (const c of concepts.slice(0, practised)) {
    rows[c.id] = { attempted: 10, correct: 10 };
    conceptDays[c.id] = days(2);
  }
  return { concepts, source: { stats: [stats('biases', rows)], conceptDays } };
}

const baseSource = (over: Partial<BadgeSource> = {}): BadgeSource => ({
  concepts: [],
  pairs: [],
  stats: [],
  conceptDays: {},
  calibration: [],
  ...over,
});

/** Thirty lifetime answers that qualify knows-what-it-knows: 13 of 15 right at 90, 3 of 15 right at 50. */
function knowsQualifying(): BadgeSource['calibration'] {
  const high = Array.from({ length: 15 }, (_, i) => ({
    confidence: 90,
    correct: i < 13,
    format: 'two-way' as const,
  }));
  const low = Array.from({ length: 15 }, (_, i) => ({
    confidence: 50,
    correct: i < 3,
    format: 'two-way' as const,
  }));
  return [...high, ...low];
}

describe('buildBadgeContext', () => {
  it('maps every knowledge-base concept, and a concept with no evidence is new', () => {
    const concepts = [concept('a'), concept('b'), concept('c')];
    const ctx = buildBadgeContext(baseSource({ concepts }));

    expect(ctx.mastery.size).toBe(3);
    expect(ctx.mastery.get('a')).toBe('new');
  });

  it('pools attempts across quiz records before judging mastery', () => {
    const concepts = [concept('a')];
    const ctx = buildBadgeContext(
      baseSource({
        concepts,
        stats: [
          stats('biases', { a: { attempted: 3, correct: 3 } }),
          stats('reasoning-traps', { a: { attempted: 3, correct: 3 } }),
        ],
        conceptDays: { a: days(2) },
      }),
    );

    expect(ctx.mastery.get('a')).toBe('practised');
  });

  it('does not master a concept seen on a single practice day', () => {
    const concepts = [concept('a')];
    const ctx = buildBadgeContext(
      baseSource({
        concepts,
        stats: [stats('biases', { a: { attempted: 10, correct: 10 } })],
        conceptDays: { a: days(1) },
      }),
    );

    expect(ctx.mastery.get('a')).toBe('practised');
  });

  it('masters a concept over two practice days', () => {
    const concepts = [concept('a')];
    const ctx = buildBadgeContext(
      baseSource({
        concepts,
        stats: [stats('biases', { a: { attempted: 10, correct: 10 } })],
        conceptDays: { a: days(2) },
      }),
    );

    expect(ctx.mastery.get('a')).toBe('mastered');
  });

  it('ignores ids that are not knowledge-base concepts', () => {
    const ctx = buildBadgeContext(
      baseSource({
        concepts: [concept('a')],
        stats: [stats('reasoning-traps', { 'sound-reasoning': { attempted: 9, correct: 9 } })],
      }),
    );

    expect(ctx.mastery.has('sound-reasoning')).toBe(false);
    expect(ctx.mastery.size).toBe(1);
  });

  it('passes pairs and calibration through and leaves extra empty', () => {
    const pairs: ConfusedPair[] = [{ concepts: ['a', 'b'] }];
    const calibration = knowsQualifying();
    const ctx = buildBadgeContext(baseSource({ pairs, calibration }));

    expect(ctx.pairs).toEqual(pairs);
    expect(ctx.calibration).toEqual(calibration);
    expect(ctx.extra).toEqual({});
  });
});

describe('badgesToRecord', () => {
  it('returns a newly earned badge once, with a one-line evidence string', () => {
    const { concepts, source } = sixteen(8);
    const records = badgesToRecord(baseSource({ ...source, concepts }), {});

    expect(records.map((r) => r.id)).toEqual(['names-the-trap']);
    expect(records[0].evidence).toMatch(/8 of 16/);
    expect(records[0].evidence).not.toContain('\n');
  });

  it('skips a badge that is already stored', () => {
    const { concepts, source } = sixteen(8);
    const records = badgesToRecord(baseSource({ ...source, concepts }), {
      'names-the-trap': { earnedAt: '2026-10-01T00:00:00.000Z', evidence: 'old' },
    });

    expect(records).toEqual([]);
  });

  it('records notices-lookalikes when both concepts of a confused pair are practised', () => {
    const concepts = [concept('alpha', 'Alpha'), concept('beta', 'Beta')];
    const records = badgesToRecord(
      baseSource({
        concepts,
        pairs: [{ concepts: ['alpha', 'beta'] }],
        stats: [
          stats('biases', {
            alpha: { attempted: 4, correct: 4 },
            beta: { attempted: 4, correct: 4 },
          }),
        ],
        conceptDays: { alpha: days(1), beta: days(1) },
      }),
      {},
    );

    expect(records.map((r) => r.id)).toEqual(['notices-lookalikes']);
    expect(records[0].evidence).toMatch(/Alpha/);
    expect(records[0].evidence).toMatch(/Beta/);
  });

  it('records knows-what-it-knows from thirty lifetime answers and not sure-means-sure', () => {
    const records = badgesToRecord(baseSource({ calibration: knowsQualifying() }), {});

    expect(records.map((r) => r.id)).toEqual(['knows-what-it-knows']);
    expect(records[0].evidence.length).toBeGreaterThan(0);
  });
});
