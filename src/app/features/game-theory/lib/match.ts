import { BOT_IDS, ROSTER } from './bots';
import type {
  BotId,
  Horizon,
  MatchConfig,
  MatchResult,
  Move,
  PdPayoffs,
  TurnRecord,
} from './bots.types';
import type { Rng } from './rng.types';

// Matches between bots, or between a human and a bot (spec §8.1).
//
// Turns are numbered from 0. Each turn takes rng draws in this fixed order:
//   1. A's noise draw. It is always taken, even when A is the human (then its value is unused).
//   2. B's noise draw, always taken.
//   3. A's strategy draw, only if A is a bot whose decide() draws (only `random` does).
//   4. B's strategy draw, under the same rule.
//   5. Under a `continue` horizon, while fewer than `cap` turns have been played: one continuation
//      draw. The match goes on when the draw is below p. A `fixed` horizon takes no such draw.
// A noise draw below config.noise flips that side's PLAYED move. The intended move is kept on the
// record. In a human match only the bot's move can flip.
// Bots decide from both sides' PLAYED histories (after noise), and their own `mine` history is
// also played, so a flipped move is what each side remembers.
// Taking the noise draws even at noise 0 keeps the draw sequence the same shape for every noise
// setting, so changing the noise slider does not shift the random bot's stream.

/** Axelrod's Prisoner's Dilemma payoffs. T > R > P > S and 2R > T + S, checked by startMatch. */
export const PD_DEFAULT: PdPayoffs = { T: 5, R: 3, P: 1, S: 0 };

/** The human play horizon: each turn continues with p = 0.9, and the match stops at 40 turns. */
export const PLAY_HORIZON: Horizon = { kind: 'continue', p: 0.9, cap: 40 };

/** The tournament horizon: a fixed 100 turns. */
export const TOURNAMENT_HORIZON: Horizon = { kind: 'fixed', turns: 100 };

/** A match in progress. stepTurn returns a new state and never changes the one it is given. */
export interface MatchState {
  readonly config: MatchConfig;
  readonly turns: readonly TurnRecord[];
  readonly done: boolean;
}

function assertBot(id: BotId): void {
  if (!BOT_IDS.includes(id)) throw new RangeError(`unknown bot: ${id}`);
}

function assertPayoffs({ T, R, P, S }: PdPayoffs): void {
  if (!(T > R && R > P && P > S && 2 * R > T + S)) {
    throw new RangeError(
      `payoffs must satisfy T > R > P > S and 2R > T + S (T=${T}, R=${R}, P=${P}, S=${S})`,
    );
  }
}

function assertHorizon(horizon: Horizon): void {
  if (horizon.kind === 'fixed') {
    if (!Number.isInteger(horizon.turns) || horizon.turns < 1) {
      throw new RangeError(`a fixed horizon needs a whole number of turns, got ${horizon.turns}`);
    }
    return;
  }
  if (!(horizon.p >= 0 && horizon.p <= 1)) {
    throw new RangeError(`a continue horizon needs p in [0, 1], got ${horizon.p}`);
  }
  if (!Number.isInteger(horizon.cap) || horizon.cap < 1) {
    throw new RangeError(`a continue horizon needs a whole cap of at least 1, got ${horizon.cap}`);
  }
}

function assertValidConfig(config: MatchConfig): void {
  if (config.a !== 'human') assertBot(config.a);
  assertBot(config.b);
  assertPayoffs(config.payoffs);
  if (!(config.noise >= 0 && config.noise <= 0.1)) {
    throw new RangeError(`noise must be between 0 and 0.1, got ${config.noise}`);
  }
  assertHorizon(config.horizon);
}

/** Validates the config and returns a match with no turns played. */
export function startMatch(config: MatchConfig): MatchState {
  assertValidConfig(config);
  return { config, turns: [], done: false };
}

function flip(move: Move): Move {
  return move === 'C' ? 'D' : 'C';
}

/** The payoffs for one turn, as [A, B], from the played moves. */
function payoffsFor(p: PdPayoffs, a: Move, b: Move): [number, number] {
  if (a === 'C') return b === 'C' ? [p.R, p.R] : [p.S, p.T];
  return b === 'C' ? [p.T, p.S] : [p.P, p.P];
}

function requireHumanMove(move: Move | null): Move {
  if (move === null) throw new Error('a human seat needs a move, C or D');
  return move;
}

/** Whether the match goes on after `played` turns. A continue horizon draws only below its cap. */
function continues(horizon: Horizon, played: number, rng: Rng): boolean {
  if (horizon.kind === 'fixed') return played < horizon.turns;
  if (played >= horizon.cap) return false;
  return rng() < horizon.p;
}

/**
 * Plays one turn. `humanMove` is the human's C or D when config.a is 'human', and null when both
 * seats are bots. Draws follow the order in the comment at the top of this file.
 */
export function stepTurn(state: MatchState, humanMove: Move | null, rng: Rng): MatchState {
  if (state.done) throw new Error('the match is over');
  const { a, b, payoffs, noise, horizon } = state.config;
  if (a !== 'human' && humanMove !== null) throw new Error('a bot seat takes no human move');
  if (humanMove !== null && humanMove !== 'C' && humanMove !== 'D') {
    throw new Error('a human move must be C or D');
  }

  const index = state.turns.length;
  const playedA = state.turns.map((t) => t.playedA);
  const playedB = state.turns.map((t) => t.playedB);

  // Draws 1 and 2: noise, A then B.
  const noiseA = rng();
  const noiseB = rng();

  // Draws 3 and 4: intended moves, A then B. Each bot sees its own played history and the
  // opponent's played history.
  const intendedA: Move =
    a === 'human'
      ? requireHumanMove(humanMove)
      : ROSTER[a].decide({ turn: index, mine: playedA, theirs: playedB, rng });
  const intendedB: Move = ROSTER[b].decide({ turn: index, mine: playedB, theirs: playedA, rng });

  // Noise flips only bot moves, so a human match never flips A.
  const playedMoveA = a !== 'human' && noiseA < noise ? flip(intendedA) : intendedA;
  const playedMoveB = noiseB < noise ? flip(intendedB) : intendedB;
  const [payoffA, payoffB] = payoffsFor(payoffs, playedMoveA, playedMoveB);

  const turn: TurnRecord = {
    index,
    intendedA,
    intendedB,
    playedA: playedMoveA,
    playedB: playedMoveB,
    payoffA,
    payoffB,
  };
  const turns = [...state.turns, turn];
  return { config: state.config, turns, done: !continues(horizon, turns.length, rng) };
}

/** The totals and mutual cooperation so far. For a finished match, this is the final result. */
export function resultOf(state: MatchState): MatchResult {
  let totalA = 0;
  let totalB = 0;
  let mutualCooperation = 0;
  for (const turn of state.turns) {
    totalA += turn.payoffA;
    totalB += turn.payoffB;
    if (turn.playedA === 'C' && turn.playedB === 'C') mutualCooperation++;
  }
  return {
    config: state.config,
    turns: [...state.turns],
    totalA,
    totalB,
    mutualCooperation,
  };
}

/** Bot against bot, played to the end of its horizon. The caller supplies the rng. */
export function playMatch(config: MatchConfig, rng: Rng): MatchResult {
  if (config.a === 'human') {
    throw new Error('playMatch plays two bots; a human seat uses startMatch and stepTurn');
  }
  let state = startMatch(config);
  while (!state.done) {
    state = stepTurn(state, null, rng);
  }
  return resultOf(state);
}
