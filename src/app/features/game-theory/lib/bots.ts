import type { Bot, BotId, Move } from './bots.types';

// The eight bots of spec §8.1. The rules follow the table there, which ports the logic of
// ncase/trust (CC0). Only the logic is ported, never assets.
//
// Each decide() is a pure function of its StrategyContext. It reads the history it is given and
// draws from ctx.rng only when it is random. Bots see both sides' PLAYED moves, after noise.

/** The detective's fixed opening, played whatever the opponent does. */
const DETECTIVE_OPENING: readonly Move[] = ['C', 'D', 'C', 'C'];

/** Every bot id, in the order of the §8.1 table. */
export const BOT_IDS: readonly BotId[] = [
  'copycat',
  'always-cooperate',
  'always-cheat',
  'grudger',
  'detective',
  'copykitten',
  'simpleton',
  'random',
];

/**
 * The roster. conceptIds is a proposal: the spec names no bot-to-concept mapping, so content work
 * (G29) should confirm it before name-the-bot credits it.
 */
export const ROSTER: Readonly<Record<BotId, Bot>> = {
  copycat: {
    id: 'copycat',
    name: 'Copycat',
    blurb: 'Cooperates first, then repeats whatever you did last turn.',
    tell: 'Mirrors you, one turn late',
    conceptIds: ['tit-for-tat'],
    confusableWith: ['copykitten', 'detective', 'grudger', 'simpleton'],
    decide: ({ theirs }) => (theirs.length === 0 ? 'C' : theirs[theirs.length - 1]),
  },
  'always-cooperate': {
    id: 'always-cooperate',
    name: 'Always Cooperate',
    blurb: 'Cooperates every turn, whatever you do.',
    tell: 'Never retaliates',
    conceptIds: ['repeated-game'],
    confusableWith: [],
    decide: () => 'C',
  },
  'always-cheat': {
    id: 'always-cheat',
    name: 'Always Cheat',
    blurb: 'Defects every turn, whatever you do.',
    tell: 'Never cooperates',
    conceptIds: ['dominant-strategy'],
    confusableWith: [],
    decide: () => 'D',
  },
  grudger: {
    id: 'grudger',
    name: 'Grudger',
    blurb: 'Cooperates until you defect once, then defects for the rest of the match.',
    tell: 'Never forgives',
    conceptIds: ['repeated-game'],
    confusableWith: ['copycat', 'copykitten', 'simpleton'],
    decide: ({ theirs }) => (theirs.includes('D') ? 'D' : 'C'),
  },
  detective: {
    id: 'detective',
    name: 'Detective',
    blurb:
      'Opens with C, D, C, C to test you. If you never defect, it defects for good; otherwise it copies you.',
    tell: 'Odd opening, then exploits or mirrors',
    conceptIds: ['repeated-game'],
    confusableWith: ['copycat'],
    decide: ({ turn, theirs }) => {
      if (turn < DETECTIVE_OPENING.length) return DETECTIVE_OPENING[turn];
      if (!theirs.includes('D')) return 'D';
      return theirs[theirs.length - 1];
    },
  },
  copykitten: {
    id: 'copykitten',
    name: 'Copykitten',
    blurb: 'Cooperates unless you defect twice in a row.',
    tell: 'Forgives a single defection',
    conceptIds: ['repeated-game'],
    confusableWith: ['copycat', 'grudger', 'simpleton'],
    decide: ({ theirs }) => {
      const n = theirs.length;
      return n >= 2 && theirs[n - 1] === 'D' && theirs[n - 2] === 'D' ? 'D' : 'C';
    },
  },
  simpleton: {
    id: 'simpleton',
    name: 'Simpleton',
    blurb: 'Cooperates when you both made the same move last turn, and defects when you did not.',
    tell: 'Repeats after good outcomes, flips after bad ones',
    conceptIds: ['repeated-game'],
    confusableWith: ['copycat', 'copykitten', 'grudger'],
    decide: ({ mine, theirs }) => {
      const n = theirs.length;
      if (n === 0) return 'C';
      return mine[n - 1] === theirs[n - 1] ? 'C' : 'D';
    },
  },
  random: {
    id: 'random',
    name: 'Random',
    blurb: 'Flips a fair coin every turn.',
    tell: 'No pattern',
    conceptIds: ['mixed-strategy'],
    confusableWith: [],
    decide: ({ rng }) => (rng() < 0.5 ? 'C' : 'D'),
  },
};
