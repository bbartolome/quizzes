import { describe, expect, it } from 'vitest';
import { BOT_IDS, ROSTER } from './bots';
import { NAMEABLE, nameOptions, pickHiddenBot } from './name-bot';
import { mulberry32 } from './rng';

// Name-the-bot (spec §8.1). Only bots with three confusable partners can offer four names, and
// the spec's confusable sets give exactly four bots that many (see §14, the v1 cut of G28).

describe('name-the-bot pool and options (spec §8.1)', () => {
  it('names only the bots that have three or more confusable partners', () => {
    expect(NAMEABLE).toEqual(['copycat', 'grudger', 'copykitten', 'simpleton']);
    for (const id of BOT_IDS) {
      expect(NAMEABLE.includes(id)).toBe(ROSTER[id].confusableWith.length >= 3);
    }
  });

  it('picks the hidden bot from the pool, and the same rng picks the same bot', () => {
    const picks = Array.from({ length: 200 }, (_, i) => pickHiddenBot(mulberry32(i)));

    expect(new Set(picks)).toEqual(new Set(NAMEABLE));
    expect(pickHiddenBot(mulberry32(9))).toBe(pickHiddenBot(mulberry32(9)));
  });

  it('offers four distinct names: the bot itself and three of its confusable partners', () => {
    for (const bot of NAMEABLE) {
      const options = nameOptions(bot, mulberry32(42));
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(bot);
      for (const lure of options.filter((id) => id !== bot)) {
        expect(ROSTER[bot].confusableWith).toContain(lure);
      }
    }
  });

  it('shuffles the options, so the answer is not always in the same place', () => {
    const positions = Array.from({ length: 100 }, (_, i) =>
      nameOptions('copycat', mulberry32(i)).indexOf('copycat'),
    );

    expect(new Set(positions)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('is reproducible for the same rng seed', () => {
    expect(nameOptions('grudger', mulberry32(5))).toEqual(nameOptions('grudger', mulberry32(5)));
  });
});
