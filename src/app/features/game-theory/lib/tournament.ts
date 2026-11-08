import { BOT_IDS } from './bots';
import type { BotId, PdPayoffs, TournamentResult } from './bots.types';
import { TOURNAMENT_HORIZON, playMatch } from './match';
import type { Rng } from './rng.types';

// Round-robin tournament (spec §8.1). Every distinct pair in the population plays `reps` fixed
// 100-turn matches. A bot never plays itself. The rng is supplied by the caller, and the pairs play
// in population order, so the same rng gives the same table.

export interface TournamentConfig {
  noise: number;
  payoffs: PdPayoffs;
  reps: number;
}

/**
 * Ranks the population by mean payoff per turn, highest first. Ties go to roster order (BOT_IDS),
 * so the ranking never depends on the order the population was given in.
 */
export function roundRobin(
  population: readonly BotId[],
  cfg: TournamentConfig,
  rng: Rng,
): TournamentResult {
  if (population.length < 2) {
    throw new RangeError('a tournament needs at least two bots');
  }
  if (new Set(population).size !== population.length) {
    throw new RangeError('a tournament population cannot repeat a bot');
  }
  if (!Number.isInteger(cfg.reps) || cfg.reps < 1) {
    throw new RangeError(`reps must be a whole number of at least 1, got ${cfg.reps}`);
  }

  const totals = new Map<BotId, { payoff: number; turns: number }>(
    population.map((id) => [id, { payoff: 0, turns: 0 }]),
  );

  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      for (let rep = 0; rep < cfg.reps; rep++) {
        const result = playMatch(
          {
            a: population[i],
            b: population[j],
            horizon: TOURNAMENT_HORIZON,
            noise: cfg.noise,
            payoffs: cfg.payoffs,
            seed: `${i}-${j}-${rep}`,
          },
          rng,
        );
        const a = totals.get(population[i]);
        const b = totals.get(population[j]);
        if (!a || !b) throw new Error('population ids are registered above');
        a.payoff += result.totalA;
        a.turns += result.turns.length;
        b.payoff += result.totalB;
        b.turns += result.turns.length;
      }
    }
  }

  const meanPerTurn = Object.fromEntries(
    population.map((id) => {
      const total = totals.get(id);
      return [id, total && total.turns > 0 ? total.payoff / total.turns : 0];
    }),
  ) as Record<BotId, number>;

  const rosterOrder = (id: BotId) => BOT_IDS.indexOf(id);
  const ranking = [...population].sort(
    (x, y) => meanPerTurn[y] - meanPerTurn[x] || rosterOrder(x) - rosterOrder(y),
  );

  return {
    population: [...population],
    noise: cfg.noise,
    reps: cfg.reps,
    meanPerTurn,
    ranking,
  };
}

/**
 * The bots tied for first: every bot whose mean payoff per turn equals the top bot's, in ranking
 * order. One bot when nobody ties, so a caller can tell a single winner from a tie.
 */
export function leadersOf(result: TournamentResult): BotId[] {
  const top = result.meanPerTurn[result.ranking[0]];
  return result.ranking.filter((id) => result.meanPerTurn[id] === top);
}
