import { describe, expect, it } from 'vitest';
import { BOT_IDS } from './bots';
import type { BotId } from './bots.types';
import { PD_DEFAULT } from './match';
import { roundRobin } from './tournament';
import { hashSeed, mulberry32 } from './rng';

const CFG = { noise: 0, payoffs: PD_DEFAULT, reps: 1 };

describe('roundRobin (spec §8.1 tournament)', () => {
  it('ranks by mean payoff per turn: always-cheat beats always-cooperate at noise 0', () => {
    const result = roundRobin(['always-cooperate', 'always-cheat'], CFG, mulberry32(1));

    expect(result.meanPerTurn['always-cheat']).toBe(PD_DEFAULT.T);
    expect(result.meanPerTurn['always-cooperate']).toBe(PD_DEFAULT.S);
    expect(result.ranking).toEqual(['always-cheat', 'always-cooperate']);
  });

  it('keeps the population, noise and reps it was given', () => {
    const result = roundRobin(['copycat', 'grudger', 'random'], { ...CFG, noise: 0.05, reps: 3 }, mulberry32(2));

    expect(result.population).toEqual(['copycat', 'grudger', 'random']);
    expect(result.noise).toBe(0.05);
    expect(result.reps).toBe(3);
    expect([...result.ranking].sort()).toEqual(['copycat', 'grudger', 'random']);
  });

  it('breaks ties by roster order, whatever order the population is given in', () => {
    // Two bots that cooperate every turn against each other earn R = 3 per turn each, so they tie.
    const first = roundRobin(['grudger', 'always-cooperate'], CFG, mulberry32(3));
    const second = roundRobin(['always-cooperate', 'grudger'], CFG, mulberry32(3));

    expect(first.meanPerTurn['always-cooperate']).toBe(PD_DEFAULT.R);
    expect(first.meanPerTurn.grudger).toBe(PD_DEFAULT.R);
    expect(first.ranking).toEqual(['always-cooperate', 'grudger']);
    expect(second.ranking).toEqual(first.ranking);
  });

  it('is reproducible for the same rng seed', () => {
    const population: BotId[] = [...BOT_IDS];
    const run = () => roundRobin(population, { ...CFG, noise: 0.03 }, mulberry32(hashSeed('t/1')));

    expect(run()).toEqual(run());
  });

  it('never has a bot play itself, so a single bot is rejected', () => {
    expect(() => roundRobin(['copycat'], CFG, mulberry32(4))).toThrow(RangeError);
  });

  it('rejects a population with a duplicate bot', () => {
    expect(() => roundRobin(['copycat', 'copycat'], CFG, mulberry32(5))).toThrow(RangeError);
  });

  it('rejects a reps count that is not a positive whole number', () => {
    expect(() => roundRobin(['copycat', 'grudger'], { ...CFG, reps: 0 }, mulberry32(6))).toThrow(
      RangeError,
    );
    expect(() => roundRobin(['copycat', 'grudger'], { ...CFG, reps: 1.5 }, mulberry32(6))).toThrow(
      RangeError,
    );
  });

  it('ranks every bot in the population exactly once', () => {
    const result = roundRobin([...BOT_IDS], { ...CFG, noise: 0.02 }, mulberry32(7));

    expect(result.ranking).toHaveLength(BOT_IDS.length);
    expect(new Set(result.ranking).size).toBe(BOT_IDS.length);
  });
});
