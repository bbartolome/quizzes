import { describe, expect, it } from 'vitest';
import { forSeeds, scripted } from '../../../../testing/seeds';
import { BOT_IDS, ROSTER } from './bots';
import type { BotId, Move, StrategyContext } from './bots.types';
import { mulberry32 } from './rng';
import type { Rng } from './rng.types';

/** An rng that counts its draws, so a test can pin how many a call takes. */
function counted(rng: Rng): { rng: Rng; draws: () => number } {
  let count = 0;
  return {
    rng: () => {
      count++;
      return rng();
    },
    draws: () => count,
  };
}

function moveOf(ch: string): Move {
  if (ch !== 'C' && ch !== 'D') throw new Error(`not a move: ${ch}`);
  return ch;
}

/**
 * One bot's moves against a fixed opponent history, such as "CCDCC". The opponent's moves do not
 * depend on the bot, so the bot's answer depends only on the history it is given.
 */
function respond(id: BotId, opponent: string, rng: Rng = mulberry32(0)): string {
  const bot = ROSTER[id];
  const mine: Move[] = [];
  const theirs: Move[] = [];
  for (const ch of opponent) {
    mine.push(bot.decide({ turn: mine.length, mine, theirs, rng }));
    theirs.push(moveOf(ch));
  }
  return mine.join('');
}

function at(rng: Rng): StrategyContext {
  return { turn: 0, mine: [], theirs: [], rng };
}

const sorted = (ids: readonly BotId[]): BotId[] => [...ids].sort();

describe('roster', () => {
  it('lists the eight strategies of the §8.1 table, in table order', () => {
    expect(BOT_IDS).toEqual([
      'copycat',
      'always-cooperate',
      'always-cheat',
      'grudger',
      'detective',
      'copykitten',
      'simpleton',
      'random',
    ]);
  });

  it.each(BOT_IDS)('%s carries its own id, a name, a blurb, a tell and concept ids', (id) => {
    const bot = ROSTER[id];
    expect(bot.id).toBe(id);
    expect(bot.name.trim()).not.toBe('');
    expect(bot.blurb.trim()).not.toBe('');
    expect(bot.tell.trim()).not.toBe('');
    expect(Array.isArray(bot.conceptIds)).toBe(true);
  });

  const tells: [BotId, string][] = [
    ['copycat', 'Mirrors you, one turn late'],
    ['always-cooperate', 'Never retaliates'],
    ['always-cheat', 'Never cooperates'],
    ['grudger', 'Never forgives'],
    ['detective', 'Odd opening, then exploits or mirrors'],
    ['copykitten', 'Forgives a single defection'],
    ['simpleton', 'Repeats after good outcomes, flips after bad ones'],
    ['random', 'No pattern'],
  ];
  it.each(tells)('%s shows the tell from the §8.1 table', (id, tell) => {
    expect(ROSTER[id].tell).toBe(tell);
  });

  it('pins the confusable sets from §8.1', () => {
    expect(sorted(ROSTER.copycat.confusableWith)).toEqual([
      'copykitten',
      'detective',
      'grudger',
      'simpleton',
    ]);
    expect(sorted(ROSTER.copykitten.confusableWith)).toEqual(['copycat', 'grudger', 'simpleton']);
    expect(sorted(ROSTER.grudger.confusableWith)).toEqual(['copycat', 'copykitten', 'simpleton']);
    expect(sorted(ROSTER.simpleton.confusableWith)).toEqual(['copycat', 'copykitten', 'grudger']);
    expect(sorted(ROSTER.detective.confusableWith)).toEqual(['copycat']);
  });

  it('lists no confusable bot for the three the spec does not group', () => {
    for (const id of ['always-cooperate', 'always-cheat', 'random'] as const) {
      expect(ROSTER[id].confusableWith).toEqual([]);
    }
  });

  it('makes confusion symmetric and never lists a bot as its own confusable', () => {
    for (const id of BOT_IDS) {
      expect(ROSTER[id].confusableWith).not.toContain(id);
      for (const other of ROSTER[id].confusableWith) {
        expect(ROSTER[other].confusableWith).toContain(id);
      }
    }
  });
});

describe('rules as written in §8.1', () => {
  it('always-cooperate cooperates every turn', () => {
    expect(respond('always-cooperate', 'CDCDD')).toBe('CCCCC');
  });

  it('always-cheat defects every turn', () => {
    expect(respond('always-cheat', 'CDCDD')).toBe('DDDDD');
  });

  it("copycat opens C, then copies the opponent's last played move", () => {
    expect(respond('copycat', 'DCDDC')).toBe('CDCDD');
  });

  it('grudger cooperates until the opponent has ever defected, then defects forever', () => {
    expect(respond('grudger', 'CCDCC')).toBe('CCCDD');
  });

  it('detective opens C, D, C, C and then defects forever when the opponent never defected', () => {
    expect(respond('detective', 'CCCCCC')).toBe('CDCCDD');
  });

  it('detective plays copycat once the opponent has defected', () => {
    expect(respond('detective', 'CCDCDC')).toBe('CDCCCD');
  });

  it('detective counts a defection inside its opening as a defection', () => {
    expect(respond('detective', 'DDDDCC')).toBe('CDCCDC');
  });

  it('copykitten defects only after two consecutive opponent defections', () => {
    expect(respond('copykitten', 'DDCDDD')).toBe('CCDCCD');
  });

  it('copykitten forgives a single defection', () => {
    expect(respond('copykitten', 'CDCC')).toBe('CCCC');
  });

  it('simpleton cooperates iff both players made the same move last turn', () => {
    expect(respond('simpleton', 'CDDCC')).toBe('CCDCC');
  });

  it('simpleton cooperates again after both players defect', () => {
    expect(respond('simpleton', 'DDD')).toBe('CDC');
  });

  it('random cooperates on a draw below one half and defects otherwise', () => {
    expect(ROSTER.random.decide(at(scripted(0.49)))).toBe('C');
    expect(ROSTER.random.decide(at(scripted(0.5)))).toBe('D');
  });

  it('random takes exactly one draw per decision', () => {
    const counter = counted(mulberry32(3));
    ROSTER.random.decide(at(counter.rng));
    expect(counter.draws()).toBe(1);
  });

  it('the seven other bots never draw from the rng', () => {
    const forbidden: Rng = () => {
      throw new Error('a deterministic bot drew from the rng');
    };
    for (const id of BOT_IDS.filter((x) => x !== 'random')) {
      expect(() => respond(id, 'CDDCCCDDCCCC', forbidden)).not.toThrow();
    }
  });

  it('every bot is stateless: the same context gives the same move after other calls', () => {
    const contexts: StrategyContext[] = [
      { turn: 0, mine: [], theirs: [], rng: mulberry32(0) },
      { turn: 2, mine: ['C', 'D'], theirs: ['D', 'D'], rng: mulberry32(0) },
      {
        turn: 5,
        mine: ['C', 'C', 'D', 'C', 'D'],
        theirs: ['C', 'D', 'D', 'C', 'C'],
        rng: mulberry32(0),
      },
    ];
    for (const id of BOT_IDS.filter((x) => x !== 'random')) {
      const bot = ROSTER[id];
      const first = contexts.map((ctx) => bot.decide(ctx));
      contexts.forEach((ctx) => bot.decide(ctx));
      expect(contexts.map((ctx) => bot.decide(ctx))).toEqual(first);
    }
  });
});

// The probe is an opponent history. Each bot is run against it, and every pair must answer it
// differently, so name-the-bot can always tell two bots apart (spec §4.2, §8.1).
//
// The §8.1 example (defect at turn 2, then cooperate) is too short: it gives always-cooperate and
// copykitten the same answer, and grudger and simpleton the same answer. The first five moves of
// this probe separate every pair of deterministic bots. The rest of the probe lowers the chance that
// random's seeded answers match a deterministic one. Over seeds 0 to 499 this 12-turn probe has no
// such match; its 10-turn prefix has two (seeds 29 and 324, both against always-cooperate). Random
// is therefore distinguished per seed, not for every possible rng stream.
const PROBE = 'CDDCCCDDCCCC';

describe('distinguishability (§4.2, §8.1)', () => {
  const pairs: [BotId, BotId][] = BOT_IDS.flatMap((a, i) =>
    BOT_IDS.slice(i + 1).map((b): [BotId, BotId] => [a, b]),
  );

  it.each(pairs)('answers the probe differently for %s and %s, for seeds 0 to 499', (a, b) => {
    forSeeds((seed) => {
      expect(respond(a, PROBE, mulberry32(seed))).not.toBe(respond(b, PROBE, mulberry32(seed)));
    });
  });
});
