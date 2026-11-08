import type { GameClass, MatrixGame, PayoffMatrix } from '../matrix.types';
import type { ClassifyPuzzle, Difficulty, PuzzleAnswer, PuzzleGrade } from '../puzzle.types';
import type { Rng } from '../rng';
import { MAX_TRIES, seedKeyFor, tagsFor, type PuzzleOptions } from './shared';
import { matrixSignature } from './signature';

// Classify puzzles (spec §5.2). Draw order for one candidate:
//   1. the class: one draw, uniform over the five classes, or none when opts.onlyClass fixes it;
//   2. the payoffs, from the class's ordinal layout:
//      - prisoner's dilemma, stag hunt and chicken: four distinct integers 0..9 for the row player,
//        sorted ascending, then four for the column player;
//      - battle of the sexes: two distinct integers 1..9 for each player, sorted ascending, and the
//        off-diagonal cells are 0 (classify2x2 recognises only this shape, see below);
//      - pure coordination: one integer 1..9 for each player, on the diagonal;
//   3. difficulty 2 and 3: one draw for a row flip and one for a column flip (each when below .5),
//      and a player swap, which is always applied and draws nothing;
//   4. difficulty 3: one draw for the cover-story pool, uniform over four pools.
// Battle of the sexes and coordination are not strict-ordinal. classify2x2 recognises only the
// template shape, and a strict-ordinal battle of the sexes classifies as "other" (see the spec).

type Canonical = Exclude<GameClass, 'other'>;
type ClassifyAnswer = Extract<PuzzleAnswer, { kind: 'classify' }>;

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

/** The feature that separates each class (spec §11 M6). Feedback names it. */
const FEATURE: Record<Canonical, string> = {
  'prisoners-dilemma':
    'Defecting is dominant: whatever the other player does, defecting gives each player more. Yet mutual cooperation gives both players more than mutual defection.',
  'stag-hunt':
    'Two stable cells, and no strategy is dominant: each best move depends on what the other does.',
  'chicken-game': 'Mutual defection is the worst outcome, and there is no dominant strategy.',
  'battle-of-the-sexes':
    'Two stable cells, and the players rank them differently: each prefers the one that suits them.',
  'coordination-game':
    'Both players gain from matching: the two stable cells are equal for both players.',
};

/** A cover story: two options that both players choose between, and one sentence of setting. */
interface Cover {
  options: [string, string];
  story: string;
}

/** Neutral cover stories, one per pool (firms, neighbours, countries, drivers). No money framing (M1). */
const COVER: Record<Canonical, Cover[]> = {
  'prisoners-dilemma': [
    {
      options: ['Share the market', 'Grab the market'],
      story:
        'Two firms choose how hard to compete in one market. Each cares about its own position.',
    },
    {
      options: ['Keep the noise down', 'Play loud music'],
      story: 'Two neighbours share a wall. Each cares about having a quiet evening.',
    },
    {
      options: ['Limit arms', 'Build up arms'],
      story: 'Two countries decide how many weapons to hold. Each cares about its own security.',
    },
    {
      options: ['Keep to the limit', 'Speed through'],
      story:
        'Two drivers reach the same junction at the same time. Each cares about getting through safely.',
    },
  ],
  'stag-hunt': [
    {
      options: ['Joint product', 'Solo product'],
      story: 'Two firms can build a joint product, which needs both, or a smaller solo product.',
    },
    {
      options: ['Organise a block party', 'Stay in'],
      story:
        'Two neighbours can organise a block party, which needs both to take part, or stay in.',
    },
    {
      options: ['Joint treaty', 'Go it alone'],
      story:
        'Two countries can sign a joint treaty, which needs both, or act alone on a smaller plan.',
    },
    {
      options: ['Form a convoy', 'Drive alone'],
      story: 'Two drivers can form a convoy, which needs both to keep one pace, or drive alone.',
    },
  ],
  'chicken-game': [
    {
      options: ['Back down', 'Hold firm'],
      story: 'Two firms race for the same contract. If neither backs down, both lose badly.',
    },
    {
      options: ['Turn the music down', 'Keep it loud'],
      story:
        'Two neighbours each want the last word on the noise. If neither gives way, both suffer.',
    },
    {
      options: ['Stand down', 'Stand firm'],
      story: 'Two countries dispute a border. If neither gives way, both suffer the most.',
    },
    {
      options: ['Swerve', 'Stay straight'],
      story: 'Two drivers meet head on in a narrow lane. If neither swerves, both crash.',
    },
  ],
  'battle-of-the-sexes': [
    {
      options: ['Standard A', 'Standard B'],
      story: 'Two firms must agree on one technical standard. Each wants to match the other.',
    },
    {
      options: ['The park', 'The cafe'],
      story: 'Two neighbours plan a meet-up. Each wants to meet, but they favour different places.',
    },
    {
      options: ['Summit in the north', 'Summit in the south'],
      story: 'Two countries pick a venue for a summit. Each wants the summit to happen.',
    },
    {
      options: ['Coast road', 'Inland road'],
      story:
        'Two drivers pick a route to meet on. Each wants to meet, but they favour different roads.',
    },
  ],
  'coordination-game': [
    {
      options: ['Plug type 1', 'Plug type 2'],
      story: 'Two firms choose a charger plug for a shared network. Both gain only if they match.',
    },
    {
      options: ['Bins out Monday', 'Bins out Thursday'],
      story: 'Two neighbours pick a bin day. Both gain only if they match.',
    },
    {
      options: ['Metric units', 'Imperial units'],
      story: 'Two countries choose a unit system for a joint report. Both gain only if they match.',
    },
    {
      options: ['Drive on the left', 'Drive on the right'],
      story: 'Two drivers pass on an empty road. Both gain only if they keep to the same side.',
    },
  ],
};

const NEUTRAL_LABELS = ['Option 1', 'Option 2'];

/** Sorted distinct integers from lo to hi. Draws until k distinct values are seen. */
function drawSorted(rng: Rng, k: number, lo: number, hi: number): number[] {
  const picked = new Set<number>();
  while (picked.size < k) {
    picked.add(lo + Math.floor(rng() * (hi - lo + 1)));
  }
  return [...picked].sort((a, b) => a - b);
}

/** The payoffs of one candidate, in the class's canonical orientation (step 2). */
function layout(cls: Canonical, rng: Rng): { row: number[][]; col: number[][] } {
  switch (cls) {
    case 'prisoners-dilemma': {
      const v = drawSorted(rng, 4, 0, 9);
      const w = drawSorted(rng, 4, 0, 9);
      // Cells are R (both cooperate), S (sucker), T (temptation), P (both defect); T > R > P > S.
      return {
        row: [
          [v[2], v[0]],
          [v[3], v[1]],
        ],
        col: [
          [w[2], w[3]],
          [w[0], w[1]],
        ],
      };
    }
    case 'stag-hunt': {
      const v = drawSorted(rng, 4, 0, 9);
      const w = drawSorted(rng, 4, 0, 9);
      // R4 T3 P2 S1 as ranks: S < P < T < R.
      return {
        row: [
          [v[3], v[0]],
          [v[2], v[1]],
        ],
        col: [
          [w[3], w[2]],
          [w[0], w[1]],
        ],
      };
    }
    case 'chicken-game': {
      const v = drawSorted(rng, 4, 0, 9);
      const w = drawSorted(rng, 4, 0, 9);
      // T4 R3 S2 P1 as ranks: P < S < R < T.
      return {
        row: [
          [v[2], v[1]],
          [v[3], v[0]],
        ],
        col: [
          [w[2], w[3]],
          [w[1], w[0]],
        ],
      };
    }
    case 'battle-of-the-sexes': {
      // The row player prefers cell (0,0), the column player prefers (1,1).
      const a = drawSorted(rng, 2, 1, 9);
      const b = drawSorted(rng, 2, 1, 9);
      return {
        row: [
          [a[1], 0],
          [0, a[0]],
        ],
        col: [
          [b[0], 0],
          [0, b[1]],
        ],
      };
    }
    case 'coordination-game': {
      const d = drawSorted(rng, 1, 1, 9)[0];
      const e = drawSorted(rng, 1, 1, 9)[0];
      return {
        row: [
          [d, 0],
          [0, d],
        ],
        col: [
          [e, 0],
          [0, e],
        ],
      };
    }
  }
}

/** A game, with its strategy labels. The labels move with the payoffs under every relabelling. */
interface Oriented {
  row: number[][];
  col: number[][];
  rowLabels: string[];
  colLabels: string[];
}

function transpose(grid: number[][]): number[][] {
  return grid[0].map((_, c) => grid.map((line) => line[c]));
}

function swapPlayers(o: Oriented): Oriented {
  return {
    row: transpose(o.col),
    col: transpose(o.row),
    rowLabels: o.colLabels,
    colLabels: o.rowLabels,
  };
}

function flipRows(o: Oriented): Oriented {
  return {
    row: [...o.row].reverse(),
    col: [...o.col].reverse(),
    rowLabels: [...o.rowLabels].reverse(),
    colLabels: o.colLabels,
  };
}

function flipCols(o: Oriented): Oriented {
  return {
    row: o.row.map((line) => [...line].reverse()),
    col: o.col.map((line) => [...line].reverse()),
    rowLabels: o.rowLabels,
    colLabels: [...o.colLabels].reverse(),
  };
}

function drawOnce(difficulty: Difficulty, rng: Rng, opts: PuzzleOptions): ClassifyPuzzle {
  // With opts.onlyClass the class is fixed, and this draw is skipped.
  const cls = opts.onlyClass ?? CLASSES[Math.floor(rng() * CLASSES.length)];
  const { row, col } = layout(cls, rng);
  let oriented: Oriented = {
    row,
    col,
    rowLabels: [...NEUTRAL_LABELS],
    colLabels: [...NEUTRAL_LABELS],
  };
  let story: string | undefined;

  if (difficulty >= 2) {
    oriented = swapPlayers(oriented);
    if (rng() < 0.5) {
      oriented = flipRows(oriented);
    }
    if (rng() < 0.5) {
      oriented = flipCols(oriented);
    }
  }
  if (difficulty === 3) {
    const cover = COVER[cls][Math.floor(rng() * 4)];
    // Both players choose between the same two options, so the labels are the options.
    oriented = { ...oriented, rowLabels: [...cover.options], colLabels: [...cover.options] };
    story = cover.story;
  }

  const payoffs: PayoffMatrix = { rows: 2, cols: 2, row: oriented.row, col: oriented.col };
  const game: MatrixGame = {
    rowLabels: oriented.rowLabels,
    colLabels: oriented.colLabels,
    payoffs,
    ...(story === undefined ? {} : { story }),
  };
  return {
    kind: 'classify',
    difficulty,
    game,
    conceptIds: [cls],
    tags: tagsFor(payoffs),
    seedKey: seedKeyFor('classify', difficulty, payoffs, opts.seedKey),
    solution: cls,
    choices: [...CLASSES],
  };
}

/** The class a concept id names, or undefined when the id is not one of the five classes. */
export function classOf(conceptId: string | undefined): Canonical | undefined {
  return CLASSES.find((cls) => cls === conceptId);
}

/**
 * Draws a classify puzzle. Candidates whose signature is in opts.avoid are redrawn, up to MAX_TRIES.
 * If every try is avoided, the last candidate is returned.
 */
export function drawClassify(
  difficulty: Difficulty,
  rng: Rng,
  opts: PuzzleOptions = {},
): ClassifyPuzzle {
  const avoid = new Set(opts.avoid ?? []);
  let puzzle = drawOnce(difficulty, rng, opts);
  for (let tries = 1; tries < MAX_TRIES && avoid.has(matrixSignature(puzzle.game)); tries++) {
    puzzle = drawOnce(difficulty, rng, opts);
  }
  return puzzle;
}

/** Grades a classify answer. The note names the feature that separates the true class (spec §11 M6). */
export function gradeClassify(p: ClassifyPuzzle, a: ClassifyAnswer): PuzzleGrade {
  const correct = a.choice === p.solution;
  const feature = FEATURE[p.solution as Canonical];
  let note: string;
  if (correct) {
    note = `Correct. ${feature}`;
  } else if (a.choice === 'other') {
    note = `It is ${NAMES[p.solution]}. ${feature}`;
  } else {
    note = `It is ${NAMES[p.solution]}, not ${NAMES[a.choice]}. ${feature}`;
  }
  return { correct, score: correct ? 1 : 0, note };
}
