import { describe, expect, it } from 'vitest';
import { bruteForcePureNash } from '../../../../../testing/brute-force-nash';
import { CANONICAL_GAMES, eightSymmetries } from '../../../../../testing/gt-fixtures';
import { forSeeds } from '../../../../../testing/seeds';
import { classify2x2 } from '../classify';
import { paretoOptimal } from '../matrix';
import type { CellRef, GameClass, PayoffMatrix } from '../matrix.types';
import type { ClassifyPuzzle, Difficulty, PuzzleTag } from '../puzzle.types';
import { mulberry32 } from '../rng';
import { drawClassify, gradeClassify } from './classify-puzzle';
import { matrixSignature } from './signature';

type Canonical = Exclude<GameClass, 'other'>;

const CLASSES: Canonical[] = [
  'prisoners-dilemma',
  'stag-hunt',
  'chicken-game',
  'battle-of-the-sexes',
  'coordination-game',
];

const NAMES: Record<GameClass, string> = {
  'prisoners-dilemma': "Prisoner's Dilemma",
  'stag-hunt': 'Stag Hunt',
  'chicken-game': 'Chicken',
  'battle-of-the-sexes': 'Battle of the Sexes',
  'coordination-game': 'Pure coordination',
  other: 'none of these',
};

/** The separating feature each class's feedback must name (spec §5.2, §11 M6). */
const FEATURE: Record<Canonical, RegExp> = {
  'prisoners-dilemma': /defecting is dominant/i,
  'stag-hunt': /two stable cells, and no strategy is dominant/i,
  'chicken-game': /mutual defection is the worst outcome/i,
  'battle-of-the-sexes': /the players rank them differently/i,
  'coordination-game': /both players gain from matching/i,
};

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

/** Words that frame payoffs as money (spec §11 M1). Checked on labels and stories only. */
const MONEY =
  /\b(money|profit|profits|price|prices|pay|pays|paid|cost|costs|dollars?|cash|revenue|earn|earns|earnings|sales)\b|\$/i;

const cell = (r: number, c: number): CellRef => ({ r, c });

/** Pure equilibria that are not Pareto optimal, computed independently of the tags under test. */
function nePareto(m: PayoffMatrix): { ne: CellRef[]; notPareto: boolean } {
  const ne = bruteForcePureNash(m);
  const optimal = paretoOptimal(m);
  const notPareto = ne.some((n) => !optimal.some((o) => o.r === n.r && o.c === n.c));
  return { ne, notPareto };
}

/** The payoffs of one player are four distinct integers. */
const distinctFour = (grid: number[][]) => {
  const values = grid.flat();
  return values.length === 4 && new Set(values).size === 4;
};

/** A hand-written puzzle for one canonical class, in the canonical orientation. */
function puzzleFor(cls: Canonical): ClassifyPuzzle {
  return {
    kind: 'classify',
    difficulty: 1,
    game: {
      rowLabels: ['Option 1', 'Option 2'],
      colLabels: ['Option 1', 'Option 2'],
      payoffs: CANONICAL_GAMES[cls],
    },
    conceptIds: [cls],
    tags: [],
    seedKey: `test/${cls}`,
    solution: cls,
    choices: CLASSES,
  };
}

describe('classify puzzles at every difficulty', () => {
  it.each(DIFFICULTIES)('the generated class equals the intended class (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawClassify(d, mulberry32(seed));
      expect(classify2x2(puzzle.game.payoffs)).toBe(puzzle.solution);
    }, 500);
  });

  it.each(DIFFICULTIES)('keeps the class under all 8 relabellings (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawClassify(d, mulberry32(seed));
      for (const payoffs of eightSymmetries(puzzle.game.payoffs)) {
        expect(classify2x2(payoffs)).toBe(puzzle.solution);
      }
    }, 300);
  });

  it.each(DIFFICULTIES)('offers the five classes as choices (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawClassify(d, mulberry32(seed));
      expect(puzzle.choices).toEqual(CLASSES);
      expect(puzzle.choices).toContain(puzzle.solution);
    }, 100);
  });

  it.each(DIFFICULTIES)('uses 2x2 integer payoffs from 0 to 9 (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const { payoffs } = drawClassify(d, mulberry32(seed)).game;
      expect(payoffs.rows).toBe(2);
      expect(payoffs.cols).toBe(2);
      for (const v of [...payoffs.row.flat(), ...payoffs.col.flat()]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(9);
      }
    }, 200);
  });

  it.each(DIFFICULTIES)('sets tags that match the game (difficulty %i)', (d) => {
    forSeeds((seed) => {
      const puzzle = drawClassify(d, mulberry32(seed));
      const { ne, notPareto } = nePareto(puzzle.game.payoffs);
      const expected: PuzzleTag[] = [];
      if (notPareto) {
        expected.push('ne-not-pareto');
      }
      if (ne.length === 0) {
        expected.push('no-pure-ne');
      }
      if (ne.length >= 2) {
        expected.push('multiple-ne');
      }
      expect([...puzzle.tags].sort()).toEqual([...expected].sort());
    }, 200);
  });

  it.each(DIFFICULTIES)('credits the solution class as its only concept (difficulty %i)', (d) => {
    const puzzle = drawClassify(d, mulberry32(9));
    expect(puzzle.conceptIds).toEqual([puzzle.solution]);
  });

  it.each(DIFFICULTIES)('is the same for the same rng seed (difficulty %i)', (d) => {
    expect(drawClassify(d, mulberry32(42))).toEqual(drawClassify(d, mulberry32(42)));
  });

  it('sets seedKey from the kind, difficulty and matrix signature, unless the caller gives one', () => {
    const puzzle = drawClassify(2, mulberry32(3));
    expect(puzzle.seedKey).toBe(`classify:2:${matrixSignature(puzzle.game)}`);
    const keyed = drawClassify(2, mulberry32(3), { seedKey: 'gt-daily/v1/2026-11-03' });
    expect(keyed.seedKey).toBe('gt-daily/v1/2026-11-03');
  });

  it.each(DIFFICULTIES)(
    'does not repeat a matrix whose signature is in avoid (difficulty %i)',
    (d) => {
      const first = drawClassify(d, mulberry32(7));
      const signature = matrixSignature(first.game);
      const next = drawClassify(d, mulberry32(7), { avoid: [signature] });
      expect(matrixSignature(next.game)).not.toBe(signature);
    },
  );
});

describe('classify puzzles, difficulty 1', () => {
  it('draws all five classes, interleaved: each at least 100 times in 1000 seeds', () => {
    const counts = new Map<GameClass, number>();
    forSeeds((seed) => {
      const cls = drawClassify(1, mulberry32(seed)).solution;
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }, 1000);
    for (const cls of CLASSES) {
      expect(counts.get(cls) ?? 0).toBeGreaterThanOrEqual(100);
    }
  });

  it('uses neutral labels and no cover story', () => {
    forSeeds((seed) => {
      const { game } = drawClassify(1, mulberry32(seed));
      expect(game.story).toBeUndefined();
      expect(game.rowLabels).toEqual(['Option 1', 'Option 2']);
      expect(game.colLabels).toEqual(['Option 1', 'Option 2']);
    }, 100);
  });

  it('gives the strict classes four distinct payoffs per player', () => {
    forSeeds((seed) => {
      const puzzle = drawClassify(1, mulberry32(seed));
      if (
        puzzle.solution === 'prisoners-dilemma' ||
        puzzle.solution === 'stag-hunt' ||
        puzzle.solution === 'chicken-game'
      ) {
        expect(distinctFour(puzzle.game.payoffs.row)).toBe(true);
        expect(distinctFour(puzzle.game.payoffs.col)).toBe(true);
      }
    }, 500);
  });

  it("keeps the canonical layout for the prisoner's dilemma: the row player's best payoff is in row 1, column 0", () => {
    forSeeds((seed) => {
      const puzzle = drawClassify(1, mulberry32(seed));
      if (puzzle.solution === 'prisoners-dilemma') {
        const { row } = puzzle.game.payoffs;
        expect(row[1][0]).toBe(Math.max(...row.flat()));
      }
    }, 500);
  });
});

describe('classify puzzles, difficulty 2', () => {
  it("relabels some games and not others: the canonical prisoner's dilemma layout varies", () => {
    let canonical = 0;
    let total = 0;
    forSeeds((seed) => {
      const puzzle = drawClassify(2, mulberry32(seed));
      if (puzzle.solution === 'prisoners-dilemma') {
        total++;
        if (puzzle.game.payoffs.row[1][0] === Math.max(...puzzle.game.payoffs.row.flat())) {
          canonical++;
        }
      }
    }, 500);
    expect(total).toBeGreaterThan(0);
    expect(canonical).toBeGreaterThan(0);
    expect(canonical).toBeLessThan(total);
  });

  it('keeps the strict classes strict after relabelling', () => {
    forSeeds((seed) => {
      const puzzle = drawClassify(2, mulberry32(seed));
      if (
        puzzle.solution === 'prisoners-dilemma' ||
        puzzle.solution === 'stag-hunt' ||
        puzzle.solution === 'chicken-game'
      ) {
        expect(distinctFour(puzzle.game.payoffs.row)).toBe(true);
        expect(distinctFour(puzzle.game.payoffs.col)).toBe(true);
      }
    }, 300);
  });
});

describe('classify puzzles, difficulty 3', () => {
  it('draws stories from several neutral pools, with a label pair and a story', () => {
    const stories = new Set<string>();
    forSeeds((seed) => {
      const { game } = drawClassify(3, mulberry32(seed));
      expect(game.story).toBeDefined();
      expect(game.rowLabels).toHaveLength(2);
      expect(game.colLabels).toHaveLength(2);
      stories.add(game.story ?? '');
    }, 400);
    expect(stories.size).toBeGreaterThanOrEqual(4);
  });

  it('uses no money framing in labels or stories (spec §11 M1)', () => {
    forSeeds((seed) => {
      const { game } = drawClassify(3, mulberry32(seed));
      const text = [...game.rowLabels, ...game.colLabels, game.story ?? ''].join(' | ');
      expect(text).not.toMatch(MONEY);
    }, 400);
  });
});

describe('classify puzzles, the strict-ordinal rule and its limit', () => {
  it('keeps the tied off-diagonal shape for battle of the sexes and coordination', () => {
    forSeeds((seed) => {
      const puzzle = drawClassify(1, mulberry32(seed));
      if (puzzle.solution === 'battle-of-the-sexes' || puzzle.solution === 'coordination-game') {
        const { row, col } = puzzle.game.payoffs;
        expect(row[0][1]).toBe(row[1][0]);
        expect(col[0][1]).toBe(col[1][0]);
      }
    }, 500);
  });

  it('classifies a strict game with opposed preferences as "other", so battle of the sexes keeps its tied shape', () => {
    // Two pure equilibria on the diagonal, each player prefers a different one, and every payoff
    // of each player is distinct. classify2x2 recognises only the template shape, so this is "other".
    const strictBattle: PayoffMatrix = {
      rows: 2,
      cols: 2,
      row: [
        [3, 1],
        [0, 2],
      ],
      col: [
        [1, 0],
        [2, 3],
      ],
    };
    expect(bruteForcePureNash(strictBattle)).toEqual([cell(0, 0), cell(1, 1)]);
    expect(classify2x2(strictBattle)).toBe('other');
  });
});

describe('classify puzzles, one class (solo and test-out sets, spec §7.1, §7.2)', () => {
  it('draws only the class it is given, at every difficulty', () => {
    for (const difficulty of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 50; seed++) {
        const puzzle = drawClassify(difficulty, mulberry32(seed), { onlyClass: 'stag-hunt' });
        expect(puzzle.solution).toBe('stag-hunt');
        expect(puzzle.conceptIds).toEqual(['stag-hunt']);
      }
    }
  });
});

describe('gradeClassify', () => {
  it.each(CLASSES)('scores the right class 1 and names its separating feature (%s)', (cls) => {
    const grade = gradeClassify(puzzleFor(cls), { kind: 'classify', choice: cls });
    expect(grade.correct).toBe(true);
    expect(grade.score).toBe(1);
    expect(grade.note).toMatch(FEATURE[cls]);
  });

  it.each(CLASSES)("scores a wrong class 0 and names the true class's feature (%s)", (cls) => {
    const wrong = CLASSES.find((other) => other !== cls) as Canonical;
    const grade = gradeClassify(puzzleFor(cls), { kind: 'classify', choice: wrong });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.note).toContain(`It is ${NAMES[cls]}`);
    expect(grade.note).toContain(`not ${NAMES[wrong]}`);
    expect(grade.note).toMatch(FEATURE[cls]);
  });

  it('treats "other" as wrong, and does not call it "not none of these"', () => {
    const grade = gradeClassify(puzzleFor('prisoners-dilemma'), {
      kind: 'classify',
      choice: 'other',
    });
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.note).not.toMatch(/not none of these/);
    expect(grade.note).toMatch(FEATURE['prisoners-dilemma']);
  });

  it('keeps every note free of "best outcome" and "what players will do" (M2, M4)', () => {
    for (const cls of CLASSES) {
      for (const choice of [...CLASSES, 'other' as const]) {
        const { note } = gradeClassify(puzzleFor(cls), { kind: 'classify', choice });
        expect(note).not.toMatch(/best outcome|what players will do/i);
      }
    }
  });
});

describe('classify puzzles at difficulty 3, all classes', () => {
  it('draws all five classes', () => {
    const seen = new Set<GameClass>();
    forSeeds((seed) => {
      seen.add(drawClassify(3, mulberry32(seed)).solution);
    }, 500);
    expect([...seen].sort()).toEqual([...CLASSES].sort());
  });
});
