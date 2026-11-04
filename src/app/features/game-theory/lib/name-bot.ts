import { BOT_IDS, ROSTER } from './bots';
import type { BotId } from './bots.types';
import type { Rng } from './rng';

// Name-the-bot (spec §8.1). Pure: the hidden bot and its four names come from the rng.

/** A bot can be named only when it has three confusable partners to offer as lures. */
export const NAMEABLE: readonly BotId[] = BOT_IDS.filter(
  (id) => ROSTER[id].confusableWith.length >= 3,
);

/** A Fisher-Yates shuffle that draws one rng value per swap. Returns a new array. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The hidden bot: uniform over the nameable pool. */
export function pickHiddenBot(rng: Rng): BotId {
  return NAMEABLE[Math.floor(rng() * NAMEABLE.length)];
}

/**
 * The four names on screen: the bot and three of its confusable partners, in a shuffled order.
 * Draws the three lures first, then the order.
 */
export function nameOptions(bot: BotId, rng: Rng): BotId[] {
  const lures = shuffled(ROSTER[bot].confusableWith, rng).slice(0, 3);
  return shuffled([bot, ...lures], rng);
}
