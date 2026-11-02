import { InjectionToken } from '@angular/core';
import {
  CalibrationBank,
  CalibrationItem,
  CalibrationRound,
  DrawnItem,
  ItemLevel,
  TOPICS,
  Topic,
} from './calibration.models';

export type Rng = () => number;

export const CALIBRATION_RNG = new InjectionToken<Rng>('CALIBRATION_RNG', {
  providedIn: 'root',
  factory: () => Math.random,
});

/** Default items per round; a manifest entry may set its own `roundSize`. */
export const ROUND_SIZE = 20;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function seenItemIds(log: CalibrationRound[]): Set<string> {
  const seen = new Set<string>();
  for (const round of log) {
    for (const answer of round.answers) {
      seen.add(answer.itemId);
    }
  }
  return seen;
}

export function unseenCount(bank: CalibrationBank, log: CalibrationRound[]): number {
  const seen = seenItemIds(log);
  let count = 0;
  for (const item of bank.items) {
    if (!seen.has(item.id)) {
      count++;
    }
  }
  return count;
}

export function drawRound(
  bank: CalibrationBank,
  log: CalibrationRound[],
  rng: Rng,
  roundSize: number = ROUND_SIZE,
): DrawnItem[] {
  const size = Math.min(roundSize, bank.items.length);
  const seen = seenItemIds(log);
  const itemIds =
    bank.items.length < roundSize
      ? bank.items.map((item) => item.id)
      : pickIds(bank, log, seen, size, rng);
  const drawn = itemIds.map((itemId) => ({ itemId, swapped: rng() < 0.5 }));
  return shuffle(drawn, rng);
}

/**
 * Per-topic quotas for a round of `size` items: `floor(size / 6)` per topic,
 * plus one extra for `size mod 6` topics chosen at random (rng draws: one shuffle).
 * At size 20 this is 3 per topic and 2 extras, as before.
 */
function quotasFor(rng: Rng, size: number): Map<Topic, number> {
  const base = Math.floor(size / TOPICS.length);
  const extraCount = size % TOPICS.length;
  const extras = new Set(shuffle([...TOPICS], rng).slice(0, extraCount));
  const quotas = new Map<Topic, number>();
  for (const topic of TOPICS) {
    quotas.set(topic, base + (extras.has(topic) ? 1 : 0));
  }
  return quotas;
}

/**
 * Items per level for a round of `size`: 40% / 40% / 20% by largest remainder
 * (ties go to the lower level). At 10 that is 4 / 4 / 2; at 20, 8 / 8 / 4.
 */
export function levelMix(size: number): ItemLevel[] {
  const raw = [0.4 * size, 0.4 * size, 0.2 * size];
  const counts = raw.map(Math.floor);
  let left = size - counts.reduce((a, b) => a + b, 0);
  const order = [0, 1, 2].sort((a, b) => raw[b] - counts[b] - (raw[a] - counts[a]) || a - b);
  for (const i of order) {
    if (left-- > 0) counts[i]++;
  }
  const levels: ItemLevel[] = [];
  ([1, 2, 3] as const).forEach((level, i) => {
    for (let n = 0; n < counts[i]; n++) levels.push(level);
  });
  return levels;
}

/** An unseen candidate at `level`, else at the nearest level (lower first on a tie); random within a level. */
function nearestLevel(
  candidates: CalibrationItem[],
  level: ItemLevel,
  rng: Rng,
): CalibrationItem | undefined {
  for (const distance of [0, 1, 2]) {
    const wanted = distance === 0 ? [level] : [level - distance, level + distance];
    const options = candidates.filter(
      (item) => item.level !== undefined && wanted.includes(item.level),
    );
    if (options.length > 0) {
      return options[Math.floor(rng() * options.length)];
    }
  }
  return undefined;
}

function lastAnsweredAt(log: CalibrationRound[]): Map<string, string> {
  const last = new Map<string, string>();
  for (const round of log) {
    for (const answer of round.answers) {
      const current = last.get(answer.itemId);
      if (current === undefined || round.submittedAt > current) {
        last.set(answer.itemId, round.submittedAt);
      }
    }
  }
  return last;
}

function pickIds(
  bank: CalibrationBank,
  log: CalibrationRound[],
  seen: Set<string>,
  size: number,
  rng: Rng,
): string[] {
  const quotas = quotasFor(rng, size);
  const levelled = bank.items.some((item) => item.level !== undefined);

  const itemsByTopic = new Map<Topic, CalibrationItem[]>();
  for (const topic of TOPICS) {
    itemsByTopic.set(topic, []);
  }
  for (const item of bank.items) {
    itemsByTopic.get(item.topic)?.push(item);
  }

  const picked: CalibrationItem[] = [];
  const pickedIds = new Set<string>();
  const pick = (item: CalibrationItem): void => {
    picked.push(item);
    pickedIds.add(item.id);
  };

  // 1. Fill each topic's quota with that topic's unseen items, at random.
  // Levelled banks: a shuffled multiset of levels is assigned to the slots first
  // (rng draws: one shuffle of the level multiset), and each slot takes an unseen
  // item of its topic and level, else the nearest level in that topic.
  // Banks with no levels skip this branch entirely, so their rng sequence is unchanged.
  if (levelled) {
    const levels = shuffle(levelMix(size), rng);
    let slot = 0;
    for (const topic of TOPICS) {
      for (let n = quotas.get(topic) ?? 0; n > 0; n--) {
        const level = levels[slot++];
        const candidates = (itemsByTopic.get(topic) ?? []).filter(
          (item) => !seen.has(item.id) && !pickedIds.has(item.id),
        );
        const match = nearestLevel(candidates, level, rng);
        if (match) pick(match);
      }
    }
  } else {
    for (const topic of TOPICS) {
      let remaining = quotas.get(topic) ?? 0;
      if (remaining === 0) continue;
      const candidates = shuffle(
        (itemsByTopic.get(topic) ?? []).filter((item) => !seen.has(item.id)),
        rng,
      );
      for (const item of candidates) {
        if (remaining === 0) break;
        pick(item);
        remaining--;
      }
    }
  }

  // 2. Freshness beats balance: fill with unseen items from any topic, at random.
  if (picked.length < size) {
    const rest = bank.items.filter((item) => !seen.has(item.id) && !pickedIds.has(item.id));
    for (const item of shuffle(rest, rng).slice(0, size - picked.length)) {
      pick(item);
    }
  }

  // 3. Only now fall back to seen items, least recently answered first,
  // preferring topics whose quota is unfilled; ties broken at random.
  if (picked.length < size) {
    const last = lastAnsweredAt(log);
    const counts = new Map<Topic, number>();
    for (const topic of TOPICS) {
      counts.set(topic, 0);
    }
    for (const item of picked) {
      counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
    }
    const unfilled = (item: CalibrationItem): boolean =>
      (counts.get(item.topic) ?? 0) < (quotas.get(item.topic) ?? 0);
    const dateOf = (item: CalibrationItem): string => last.get(item.id) ?? '';
    const candidates = shuffle(
      bank.items.filter((item) => seen.has(item.id) && !pickedIds.has(item.id)),
      rng,
    ).sort((a, b) => {
      if (unfilled(a) !== unfilled(b)) {
        return unfilled(a) ? -1 : 1;
      }
      const da = dateOf(a);
      const db = dateOf(b);
      return da < db ? -1 : da > db ? 1 : 0;
    });
    for (const item of candidates) {
      if (picked.length >= size) break;
      pick(item);
    }
  }

  return picked.map((item) => item.id);
}
