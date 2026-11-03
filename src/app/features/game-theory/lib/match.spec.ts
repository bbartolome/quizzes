import { describe, expect, it } from 'vitest';
import { forSeeds, scripted } from '../../../../testing/seeds';
import { BOT_IDS } from './bots';
import type { BotId, Horizon, MatchConfig, Move, PdPayoffs } from './bots.types';
import {
  PD_DEFAULT,
  PLAY_HORIZON,
  TOURNAMENT_HORIZON,
  playMatch,
  resultOf,
  startMatch,
  stepTurn,
} from './match';
import { hashSeed, mulberry32 } from './rng';
import type { Rng } from './rng.types';

/** An rng that counts its draws, so a test can pin how many a match takes. */
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

/**
 * A seeded rng that throws after 100000 draws. Every match here ends within a few hundred draws,
 * so a broken horizon fails the test instead of hanging the run.
 */
function seeded(seed: number): Rng {
  const next = mulberry32(seed);
  let left = 100000;
  return () => {
    if (left-- <= 0) throw new Error('the match drew 100000 times and did not end');
    return next();
  };
}

function config(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    a: 'always-cooperate',
    b: 'always-cooperate',
    horizon: { kind: 'fixed', turns: 3 },
    noise: 0,
    payoffs: PD_DEFAULT,
    seed: 'test',
    ...over,
  };
}

const oneTurn = (over: Partial<MatchConfig> = {}): MatchConfig =>
  config({ horizon: { kind: 'fixed', turns: 1 }, ...over });

// The Prisoner's Dilemma cells written out by hand, so the checks do not reuse the implementation.
const CELLS: Record<string, [number, number]> = {
  CC: [3, 3],
  CD: [0, 5],
  DC: [5, 0],
  DD: [1, 1],
};

const BOT_PAIRS: [BotId, BotId][] = BOT_IDS.flatMap((a) =>
  BOT_IDS.map((b): [BotId, BotId] => [a, b]),
);

describe('payoffs', () => {
  it('defaults to Axelrod T5 R3 P1 S0', () => {
    expect(PD_DEFAULT).toEqual({ T: 5, R: 3, P: 1, S: 0 });
  });

  const cases: [string, BotId, BotId, string][] = [
    ['both cooperate', 'always-cooperate', 'always-cooperate', 'CC'],
    ['A cooperates, B defects', 'always-cooperate', 'always-cheat', 'CD'],
    ['A defects, B cooperates', 'always-cheat', 'always-cooperate', 'DC'],
    ['both defect', 'always-cheat', 'always-cheat', 'DD'],
  ];
  it.each(cases)('scores %s from the played moves', (_label, a, b, cell) => {
    const [turn] = playMatch(oneTurn({ a, b }), seeded(0)).turns;
    expect([turn.payoffA, turn.payoffB]).toEqual(CELLS[cell]);
  });

  it('accepts any payoffs with T > R > P > S and 2R > T + S', () => {
    expect(() => startMatch(config({ payoffs: { T: 4, R: 3, P: 2, S: 1 } }))).not.toThrow();
  });

  const broken: [string, PdPayoffs][] = [
    ['T equal to R', { T: 3, R: 3, P: 1, S: 0 }],
    ['R below P', { T: 5, R: 1, P: 3, S: 0 }],
    ['P equal to S', { T: 5, R: 3, P: 0, S: 0 }],
    ['2R not above T + S', { T: 10, R: 3, P: 1, S: 0 }],
    ['2R equal to T + S', { T: 4, R: 2, P: 1, S: 0 }],
    ['a NaN payoff', { T: Number.NaN, R: 3, P: 1, S: 0 }],
  ];
  it.each(broken)('rejects payoffs with %s', (_label, payoffs) => {
    expect(() => startMatch(config({ payoffs }))).toThrow(RangeError);
    expect(() => playMatch(config({ payoffs }), seeded(0))).toThrow(RangeError);
  });
});

describe('config validation', () => {
  it.each([0, 0.1])('accepts noise %s, the ends of 0 to 0.1', (noise) => {
    expect(() => startMatch(config({ noise }))).not.toThrow();
  });

  it.each([-0.01, 0.11, Number.NaN])('rejects noise %s', (noise) => {
    expect(() => startMatch(config({ noise }))).toThrow(RangeError);
  });

  const badHorizons: Horizon[] = [
    { kind: 'fixed', turns: 0 },
    { kind: 'fixed', turns: 2.5 },
    { kind: 'continue', p: 1.2, cap: 40 },
    { kind: 'continue', p: -0.1, cap: 40 },
    { kind: 'continue', p: 0.9, cap: 0 },
    { kind: 'continue', p: 0.9, cap: 4.5 },
  ];
  it.each(badHorizons)('rejects the horizon %j', (horizon) => {
    expect(() => startMatch(config({ horizon }))).toThrow(RangeError);
  });
});

describe('horizons', () => {
  it('the play horizon is continue with p 0.9 and cap 40; the tournament horizon is 100 fixed turns', () => {
    expect(PLAY_HORIZON).toEqual({ kind: 'continue', p: 0.9, cap: 40 });
    expect(TOURNAMENT_HORIZON).toEqual({ kind: 'fixed', turns: 100 });
  });

  it('a fixed horizon plays exactly that many turns, and draws only the two noise values per turn', () => {
    const counter = counted(seeded(1));
    const result = playMatch(config({ horizon: TOURNAMENT_HORIZON }), counter.rng);
    expect(result.turns).toHaveLength(100);
    expect(counter.draws()).toBe(200);
  });

  it('a continue horizon with p 0 stops after one turn', () => {
    const result = playMatch(config({ horizon: { kind: 'continue', p: 0, cap: 40 } }), seeded(7));
    expect(result.turns).toHaveLength(1);
  });

  it('a continue horizon with p 1 runs to the cap and does not draw once the cap is reached', () => {
    const counter = counted(seeded(7));
    const result = playMatch(config({ horizon: { kind: 'continue', p: 1, cap: 5 } }), counter.rng);
    expect(result.turns).toHaveLength(5);
    // Two noise draws per turn, and a continuation draw after each turn but the last.
    expect(counter.draws()).toBe(5 * 2 + 4);
  });

  it('continues on a continuation draw below p and stops on one at or above p', () => {
    const cfg = config({ horizon: PLAY_HORIZON });
    expect(playMatch(cfg, scripted(0.5, 0.5, 0.95)).turns).toHaveLength(1);
    expect(playMatch(cfg, scripted(0.5, 0.5, 0.89, 0.5, 0.5, 0.9)).turns).toHaveLength(2);
  });

  it('under PLAY_HORIZON the length is between 1 and 40, and averages about 10 over seeds 0 to 499', () => {
    let total = 0;
    const outside: string[] = [];
    forSeeds((seed) => {
      const cfg = config({ horizon: PLAY_HORIZON, seed: `len-${seed}` });
      const { turns } = playMatch(cfg, seeded(hashSeed(cfg.seed)));
      if (turns.length < 1 || turns.length > 40) outside.push(cfg.seed);
      total += turns.length;
    });
    expect(outside).toEqual([]);
    const mean = total / 500;
    expect(mean).toBeGreaterThan(8.5);
    expect(mean).toBeLessThan(11.5);
  });
});

describe('draw order', () => {
  it('takes A noise, then B noise, then the strategy draws of A and then B', () => {
    // Random against random with no noise. The third draw decides A (below one half is C), and
    // the fourth decides B. Taking a strategy draw before a noise draw would change A's move.
    const [turn] = playMatch(
      oneTurn({ a: 'random', b: 'random' }),
      scripted(0.9, 0.9, 0.1, 0.9),
    ).turns;
    expect(turn.intendedA).toBe('C');
    expect(turn.intendedB).toBe('D');
  });

  it('a human match still takes A noise value, which it does not use', () => {
    const counter = counted(seeded(5));
    stepTurn(
      startMatch(
        config({ a: 'human', b: 'always-cooperate', horizon: { kind: 'fixed', turns: 2 } }),
      ),
      'C',
      counter.rng,
    );
    expect(counter.draws()).toBe(2);
  });

  it('a human match with a random bot takes noise A, noise B, then the bot strategy draw', () => {
    const counter = counted(seeded(5));
    stepTurn(
      startMatch(config({ a: 'human', b: 'random', horizon: { kind: 'fixed', turns: 2 } })),
      'C',
      counter.rng,
    );
    expect(counter.draws()).toBe(3);
  });

  it('a bot-only match with no random bot takes exactly two draws per turn', () => {
    const counter = counted(seeded(9));
    playMatch(
      config({ a: 'copycat', b: 'simpleton', horizon: { kind: 'fixed', turns: 5 } }),
      counter.rng,
    );
    expect(counter.draws()).toBe(10);
  });

  it('a random bot on both sides takes four draws per turn', () => {
    const counter = counted(seeded(9));
    playMatch(
      config({ a: 'random', b: 'random', horizon: { kind: 'fixed', turns: 3 } }),
      counter.rng,
    );
    expect(counter.draws()).toBe(12);
  });
});

describe('noise', () => {
  it('flips the played move, not the intended one', () => {
    const [turn] = playMatch(oneTurn({ noise: 0.05 }), scripted(0.01, 0.9)).turns;
    expect(turn.intendedA).toBe('C');
    expect(turn.playedA).toBe('D');
    expect(turn.playedB).toBe('C');
  });

  it('flips when the draw is below the noise rate, and not when it is equal to it', () => {
    expect(playMatch(oneTurn({ noise: 0.05 }), scripted(0.0499, 0.9)).turns[0].playedA).toBe('D');
    expect(playMatch(oneTurn({ noise: 0.05 }), scripted(0.05, 0.9)).turns[0].playedA).toBe('C');
    expect(playMatch(oneTurn({ noise: 0.05 }), scripted(0.9, 0.0499)).turns[0].playedB).toBe('D');
    expect(playMatch(oneTurn({ noise: 0.05 }), scripted(0.9, 0.05)).turns[0].playedB).toBe('C');
  });

  it('draws A before B, so the first value flips A and the second flips B', () => {
    const [turn] = playMatch(oneTurn({ noise: 0.05 }), scripted(0.9, 0.01)).turns;
    expect(turn.playedA).toBe('C');
    expect(turn.playedB).toBe('D');
  });

  it('bots see the opponent played move, so a flipped move is the one that gets answered', () => {
    // A always cooperates, but noise flips its turn 0 move to D. Copycat answers the D it saw.
    const result = playMatch(
      config({
        a: 'always-cooperate',
        b: 'copycat',
        noise: 0.05,
        horizon: { kind: 'fixed', turns: 2 },
      }),
      scripted(0.0, 0.9, 0.9, 0.9),
    );
    expect(result.turns[0].playedA).toBe('D');
    expect(result.turns[1].intendedB).toBe('D');
    expect(result.turns[1].playedB).toBe('D');
  });

  it('simpleton judges its own history by what was played, not what it meant', () => {
    // Simpleton intends C on turn 0, but noise plays D. On turn 1 it faces C. Its played D and
    // the opponent's C differ, so it defects. Judged by intent, C against C would cooperate.
    const result = playMatch(
      config({
        a: 'always-cooperate',
        b: 'simpleton',
        noise: 0.05,
        horizon: { kind: 'fixed', turns: 2 },
      }),
      scripted(0.9, 0.0, 0.9, 0.9),
    );
    expect(result.turns[0].intendedB).toBe('C');
    expect(result.turns[0].playedB).toBe('D');
    expect(result.turns[1].intendedB).toBe('D');
  });

  it('flips about one move in ten at noise 0.1', () => {
    const cfg = config({ noise: 0.1, horizon: { kind: 'fixed', turns: 2000 }, seed: 'rate' });
    const { turns } = playMatch(cfg, seeded(hashSeed(cfg.seed)));
    const flips = turns.filter((t) => t.playedA !== t.intendedA).length;
    expect(flips / 2000).toBeGreaterThan(0.08);
    expect(flips / 2000).toBeLessThan(0.12);
  });

  it('in a human match, noise flips only the bot', () => {
    const state = startMatch(
      config({
        a: 'human',
        b: 'always-cooperate',
        noise: 0.05,
        horizon: { kind: 'fixed', turns: 2 },
      }),
    );
    // The human's draw would flip a move if noise applied to the human, but it does not.
    const afterHuman = stepTurn(state, 'C', scripted(0.0, 0.9));
    expect(afterHuman.turns[0].playedA).toBe('C');
    // The bot's draw flips its cooperation to a defection.
    const afterBot = stepTurn(afterHuman, 'D', scripted(0.9, 0.0));
    expect(afterBot.turns[1].playedA).toBe('D');
    expect(afterBot.turns[1].intendedB).toBe('C');
    expect(afterBot.turns[1].playedB).toBe('D');
  });
});

describe('stepTurn (human play)', () => {
  it('starts with no turns and adds one turn per call', () => {
    const start = startMatch(
      config({ a: 'human', b: 'copycat', horizon: { kind: 'fixed', turns: 3 } }),
    );
    expect(start.done).toBe(false);
    expect(start.turns).toHaveLength(0);
    expect(stepTurn(start, 'C', seeded(0)).turns).toHaveLength(1);
  });

  it('answers the human one turn at a time, and finishes after the last turn', () => {
    let state = startMatch(
      config({ a: 'human', b: 'copycat', horizon: { kind: 'fixed', turns: 3 } }),
    );
    const rng = seeded(0);
    for (const move of ['D', 'C', 'C'] as const) {
      state = stepTurn(state, move, rng);
    }
    // Copycat opens C, copies the D it saw, then copies the C it saw.
    expect(state.turns.map((t) => t.playedB)).toEqual(['C', 'D', 'C']);
    expect(state.done).toBe(true);
  });

  it('returns a new state and leaves the old one unchanged', () => {
    const before = startMatch(
      config({ a: 'human', b: 'always-cheat', horizon: { kind: 'fixed', turns: 2 } }),
    );
    const after = stepTurn(before, 'C', seeded(0));
    expect(before.turns).toHaveLength(0);
    expect(after.turns).toHaveLength(1);
  });

  it('requires a move for a human seat', () => {
    const state = startMatch(config({ a: 'human', b: 'copycat' }));
    expect(() => stepTurn(state, null, seeded(0))).toThrow();
  });

  it('refuses a move for a bot seat', () => {
    const state = startMatch(config({ a: 'copycat', b: 'copycat' }));
    expect(() => stepTurn(state, 'C', seeded(0))).toThrow();
  });

  it('rejects a human move that is not C or D', () => {
    const state = startMatch(config({ a: 'human', b: 'copycat' }));
    expect(() => stepTurn(state, 'X' as unknown as Move, seeded(0))).toThrow();
  });

  it('refuses to step a finished match', () => {
    const done = stepTurn(startMatch(oneTurn({ a: 'human', b: 'copycat' })), 'C', seeded(0));
    expect(done.done).toBe(true);
    expect(() => stepTurn(done, 'C', seeded(0))).toThrow();
  });

  it('refuses playMatch for a human seat', () => {
    expect(() => playMatch(config({ a: 'human', b: 'copycat' }), seeded(0))).toThrow();
  });
});

describe('resultOf and playMatch totals', () => {
  it('totals a human match so far', () => {
    const state = stepTurn(
      startMatch(
        config({ a: 'human', b: 'always-cooperate', horizon: { kind: 'fixed', turns: 3 } }),
      ),
      'C',
      seeded(0),
    );
    const result = resultOf(state);
    expect(result.totalA).toBe(3);
    expect(result.totalB).toBe(3);
    expect(result.mutualCooperation).toBe(1);
    expect(result.config).toEqual(state.config);
  });

  it('totals a bot match and counts mutual cooperation on played moves', () => {
    const result = playMatch(
      config({ a: 'copycat', b: 'always-cooperate', horizon: { kind: 'fixed', turns: 5 } }),
      seeded(0),
    );
    expect(result.totalA).toBe(15);
    expect(result.totalB).toBe(15);
    expect(result.mutualCooperation).toBe(5);
  });

  it('a defector against a cooperator takes all the temptation payoff', () => {
    const result = playMatch(
      config({ a: 'always-cheat', b: 'always-cooperate', horizon: { kind: 'fixed', turns: 4 } }),
      seeded(0),
    );
    expect(result.totalA).toBe(20);
    expect(result.totalB).toBe(0);
    expect(result.mutualCooperation).toBe(0);
  });
});

describe('seeded play', () => {
  it('the same seed and config give the same MatchResult', () => {
    const cfg = config({
      a: 'random',
      b: 'simpleton',
      noise: 0.05,
      horizon: PLAY_HORIZON,
      seed: 'replay',
    });
    const run = () => playMatch(cfg, seeded(hashSeed(cfg.seed)));
    expect(run()).toEqual(run());
  });

  it('different seeds can give different matches', () => {
    const outcomes = new Set<string>();
    forSeeds((seed) => {
      const cfg = config({
        a: 'random',
        b: 'random',
        horizon: { kind: 'fixed', turns: 20 },
        seed: `s${seed}`,
      });
      outcomes.add(JSON.stringify(playMatch(cfg, seeded(hashSeed(cfg.seed))).turns));
    }, 20);
    expect(outcomes.size).toBeGreaterThan(1);
  });
});

describe('properties over every bot pair and seeds 0 to 499', () => {
  // Expected payoffs use the hand-written CELLS table, so the checks do not reuse the implementation.
  const cell = (a: Move, b: Move) => CELLS[`${a}${b}`];

  it('keeps indices, payoffs, totals and mutual cooperation consistent under noise and PLAY_HORIZON', () => {
    const problems: string[] = [];
    forSeeds((seed) => {
      for (const [a, b] of BOT_PAIRS) {
        const cfg = config({ a, b, noise: 0.1, horizon: PLAY_HORIZON, seed: `prop-${seed}` });
        const result = playMatch(cfg, seeded(hashSeed(cfg.seed)));
        const tag = `${a} vs ${b}, seed ${seed}`;
        if (result.turns.length < 1 || result.turns.length > 40) problems.push(`length: ${tag}`);
        if (JSON.stringify(result.config) !== JSON.stringify(cfg)) problems.push(`config: ${tag}`);
        result.turns.forEach((t, i) => {
          if (t.index !== i) problems.push(`index: ${tag}`);
          const [pa, pb] = cell(t.playedA, t.playedB);
          if (t.payoffA !== pa || t.payoffB !== pb) problems.push(`payoff: ${tag} turn ${i}`);
        });
        const totalA = result.turns.reduce((sum, t) => sum + t.payoffA, 0);
        const totalB = result.turns.reduce((sum, t) => sum + t.payoffB, 0);
        if (result.totalA !== totalA || result.totalB !== totalB) problems.push(`totals: ${tag}`);
        const mutual = result.turns.filter((t) => t.playedA === 'C' && t.playedB === 'C').length;
        if (result.mutualCooperation !== mutual) problems.push(`mutual: ${tag}`);
      }
    });
    expect(problems).toEqual([]);
  });

  it('with noise 0, every played move is the intended move', () => {
    const problems: string[] = [];
    forSeeds((seed) => {
      for (const [a, b] of BOT_PAIRS) {
        const cfg = config({
          a,
          b,
          noise: 0,
          horizon: { kind: 'fixed', turns: 20 },
          seed: `clean-${seed}`,
        });
        for (const t of playMatch(cfg, seeded(hashSeed(cfg.seed))).turns) {
          if (t.playedA !== t.intendedA || t.playedB !== t.intendedB) {
            problems.push(`${a} vs ${b}, seed ${seed}`);
          }
        }
      }
    });
    expect(problems).toEqual([]);
  });
});
