// PROTOTYPE fixtures + pure helpers for the calibration results report. In memory only.
export type Format = 'two-way' | 'four-way';
export type HistoryLevel = 'first' | 'some' | 'rich';
export type RoundShape = 'normal' | 'sparse';

export interface ReviewItem {
  id: string;
  prompt: string;
  pick: string;
  answer: string;
  confidence: number;
  correct: boolean;
}

export interface Bucket {
  level: number;
  n: number;
  hits: number;
  rate: number | null; // % correct, null when empty
  lo: number | null; // Wilson 95% lower, %
  hi: number | null;
}

export interface Scale {
  levels: number[];
  xMin: number;
  xMax: number;
  chance: number; // % correct by guessing
  chanceBrier: number; // Brier from always guessing at chance
}

export const SCALES: Record<Format, Scale> = {
  'two-way': { levels: [50, 60, 70, 80, 90, 100], xMin: 50, xMax: 100, chance: 50, chanceBrier: 0.25 },
  'four-way': { levels: [0, 25, 50, 75, 100], xMin: 0, xMax: 100, chance: 25, chanceBrier: 0.1875 },
};

// --- helpers -------------------------------------------------------------

export function wilson(hits: number, n: number): [number, number] {
  const z = 1.96;
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h) * 100, Math.min(1, c + h) * 100];
}

export function makeBucket(level: number, n: number, hits: number): Bucket {
  if (n === 0) return { level, n, hits, rate: null, lo: null, hi: null };
  const [lo, hi] = wilson(hits, n);
  return { level, n, hits, rate: (hits / n) * 100, lo, hi };
}

export function bucketize(items: ReviewItem[], levels: number[]): Bucket[] {
  return levels.map((level) => {
    const at = items.filter((i) => i.confidence === level);
    return makeBucket(level, at.length, at.filter((i) => i.correct).length);
  });
}

export interface Summary {
  n: number;
  brier: number | null;
  meanConfidence: number | null;
  pctCorrect: number | null;
  overUnder: number | null; // + = overconfident, in percentage points
}

export function summarize(buckets: Bucket[]): Summary {
  const n = buckets.reduce((s, b) => s + b.n, 0);
  if (n === 0) return { n, brier: null, meanConfidence: null, pctCorrect: null, overUnder: null };
  let brier = 0;
  let conf = 0;
  let hits = 0;
  for (const b of buckets) {
    const c = b.level / 100;
    brier += b.hits * (1 - c) ** 2 + (b.n - b.hits) * c ** 2;
    conf += b.level * b.n;
    hits += b.hits;
  }
  const meanConfidence = conf / n;
  const pctCorrect = (hits / n) * 100;
  return { n, brier: brier / n, meanConfidence, pctCorrect, overUnder: meanConfidence - pctCorrect };
}

/** Items to call out: a miss at 100%, or a below-chance answer. */
export function flagFor(item: ReviewItem, format: Format): string | null {
  if (item.confidence === 100 && !item.correct) return 'Miss at 100%';
  if (format === 'four-way' && item.confidence === 0) return 'Below chance';
  return null;
}

// --- lifetime-before fixtures (bucket counts: [n, hits]) -----------------

const LIFETIME: Record<Format, Record<Exclude<HistoryLevel, 'first'>, [number, number][]>> = {
  'two-way': {
    some: [[6, 3], [10, 6], [9, 6], [8, 5], [5, 4], [2, 2]],
    rich: [[30, 16], [48, 27], [52, 33], [46, 32], [38, 30], [26, 23]],
  },
  'four-way': {
    some: [[1, 0], [10, 3], [12, 6], [11, 7], [6, 5]],
    rich: [[8, 1], [60, 17], [70, 30], [64, 41], [38, 31]],
  },
};

export function lifetimeBefore(format: Format, history: HistoryLevel): Bucket[] {
  const levels = SCALES[format].levels;
  if (history === 'first') return levels.map((l) => makeBucket(l, 0, 0));
  return levels.map((l, i) => makeBucket(l, ...LIFETIME[format][history][i]));
}

// --- round fixtures ------------------------------------------------------

type TwoWay = [prompt: string, a: string, b: string, answer: 0 | 1];
const TWO_WAY: TwoWay[] = [
  ['Which is larger by area?', 'Canada', 'China', 0],
  ['Which was founded first?', 'Harvard', 'Oxford', 1],
  ['Which has more moons?', 'Mars', 'Venus', 0],
  ['Which is denser?', 'Gold', 'Lead', 0],
  ['Which is taller?', 'Eiffel Tower', 'Statue of Liberty', 0],
  ['Which came first?', 'Telephone', 'Light bulb', 0],
  ['Which has more people?', 'Australia', 'Netherlands', 0],
  ['Which is farther north?', 'London', 'Calgary', 0],
  ['Which planet is hotter on average?', 'Mercury', 'Venus', 1],
  ['Which is older?', 'Great Pyramid of Giza', 'Stonehenge', 1],
  ['Which lake is deeper?', 'Baikal', 'Tanganyika', 0],
  ['Which was written first?', 'Hamlet', 'Don Quixote', 0],
  ['Which river is longer?', 'Danube', 'Mississippi', 1],
  ['Which is closer to the Sun?', 'Earth', 'Venus', 1],
  ['Which is faster?', 'Cheetah', 'Pronghorn', 0],
  ['Which was invented first?', 'Printing press', 'Magnetic compass', 1],
  ['Which is larger?', 'Ganymede', 'Mercury', 0],
  ['Which country spans more time zones?', 'France', 'Russia', 0],
  ['Which is saltier?', 'Dead Sea', 'Red Sea', 0],
  ['Which boils at a lower temperature?', 'Ethanol', 'Water', 0],
];

type FourWay = [prompt: string, a: string, b: string, truth: [boolean, boolean]];
const FOUR_WAY: FourWay[] = [
  ['Which are mammals?', 'Platypus', 'Penguin', [true, false]],
  ['Which are landlocked?', 'Bolivia', 'Paraguay', [true, true]],
  ['Which are prime?', '51', '57', [false, false]],
  ['Which border France?', 'Spain', 'Austria', [true, false]],
  ['Which are noble gases?', 'Neon', 'Nitrogen', [true, false]],
  ['Which are south of the equator?', 'Nairobi', 'Jakarta', [true, true]],
  ['Which were US presidents?', 'Benjamin Franklin', 'Alexander Hamilton', [false, false]],
  ['Which are botanically fruits?', 'Tomato', 'Rhubarb', [true, false]],
  ['Which are Shakespeare plays?', 'Volpone', 'Coriolanus', [false, true]],
  ['Which are larger than Texas?', 'France', 'Germany', [false, false]],
  ['Which are EU members?', 'Norway', 'Ireland', [false, true]],
  ['Which are insects?', 'Spider', 'Ant', [false, true]],
  ['Which are in the Pacific?', 'Fiji', 'Mauritius', [true, false]],
  ['Which are metals?', 'Mercury', 'Silicon', [true, false]],
  ['Which melt below 100 °C?', 'Butter', 'Paraffin wax', [true, true]],
  ['Which are official languages of Switzerland?', 'Romansh', 'Dutch', [true, false]],
  ['Which are Great Lakes?', 'Erie', 'Champlain', [true, false]],
  ['Which have two humps?', 'Bactrian camel', 'Dromedary', [true, false]],
  ['Which are G7 members?', 'Canada', 'Russia', [true, false]],
  ['Which are odd?', '7 × 8', '9 × 9', [false, true]],
];

// [confidence, correct] per slot, in item order.
const ROUND_ANSWERS: Record<Format, Record<RoundShape, [number, boolean][]>> = {
  'two-way': {
    normal: [
      [90, true], [60, false], [80, true], [70, false], [100, true], [80, true], [60, true], [50, false],
      [70, true], [90, false], [80, false], [60, true], [70, true], [100, true], [90, true], [50, true],
      [80, true], [60, false], [70, true], [50, true],
    ],
    sparse: [
      [90, true], [50, false], [90, true], [90, false], [100, true], [100, true], [50, true], [50, false],
      [90, true], [100, false], [90, true], [50, true], [90, true], [100, true], [90, true], [50, true],
      [100, true], [90, false], [100, true], [100, true],
    ],
  },
  'four-way': {
    normal: [
      [75, true], [50, false], [25, false], [75, true], [100, true], [50, true], [75, false], [100, true],
      [25, true], [0, false], [75, true], [100, true], [50, false], [75, false], [25, false], [50, true],
      [75, true], [100, false], [50, true], [25, false],
    ],
    sparse: [
      [75, true], [25, false], [25, true], [75, true], [100, true], [75, false], [75, true], [100, true],
      [25, false], [75, false], [75, true], [100, true], [25, false], [75, true], [25, true], [75, false],
      [75, true], [100, false], [75, true], [25, false],
    ],
  },
};

const FOUR_LABELS = (a: string, b: string) => ['Neither', a, b, 'Both'];
const truthIndex = (t: [boolean, boolean]) => (t[0] ? 1 : 0) + (t[1] ? 2 : 0);

export function roundItems(format: Format, shape: RoundShape): ReviewItem[] {
  const answers = ROUND_ANSWERS[format][shape];
  if (format === 'two-way') {
    return TWO_WAY.map(([prompt, a, b, ans], i) => {
      const [confidence, correct] = answers[i];
      const opts = [a, b];
      return { id: `t${i}`, prompt, answer: opts[ans], pick: opts[correct ? ans : 1 - ans], confidence, correct };
    });
  }
  return FOUR_WAY.map(([prompt, a, b, truth], i) => {
    const [confidence, correct] = answers[i];
    const labels = FOUR_LABELS(a, b);
    const ti = truthIndex(truth);
    return { id: `f${i}`, prompt: `${prompt} ${a} / ${b}`, answer: labels[ti], pick: labels[correct ? ti : (ti + 1 + (i % 3)) % 4], confidence, correct };
  });
}

// --- everything a variant renders ----------------------------------------

export interface ResultsView {
  format: Format;
  scale: Scale;
  items: ReviewItem[];
  round: Bucket[];
  lifetime: Bucket[];
  roundSummary: Summary;
  lifetimeSummary: Summary;
  firstRound: boolean;
}

export function buildView(format: Format, history: HistoryLevel, shape: RoundShape): ResultsView {
  const scale = SCALES[format];
  const items = roundItems(format, shape);
  const round = bucketize(items, scale.levels);
  const lifetime = lifetimeBefore(format, history);
  return {
    format,
    scale,
    items,
    round,
    lifetime,
    roundSummary: summarize(round),
    lifetimeSummary: summarize(lifetime),
    firstRound: history === 'first',
  };
}

/** Plain-language over/underconfidence, e.g. "9 points overconfident". */
export function overUnderPhrase(s: Summary): string {
  if (s.overUnder === null) return '—';
  const v = Math.round(s.overUnder);
  if (Math.abs(v) <= 2) return 'well calibrated';
  return `${Math.abs(v)} points ${v > 0 ? 'overconfident' : 'underconfident'}`;
}
