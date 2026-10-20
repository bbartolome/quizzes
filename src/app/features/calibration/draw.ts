import { InjectionToken } from '@angular/core';
import {
  CalibrationBank,
  CalibrationItem,
  CalibrationRound,
  DrawnItem,
  TOPICS,
  Topic,
} from './calibration.models';

export type Rng = () => number;

export const CALIBRATION_RNG = new InjectionToken<Rng>('CALIBRATION_RNG', {
  providedIn: 'root',
  factory: () => Math.random,
});

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

export function drawRound(bank: CalibrationBank, log: CalibrationRound[], rng: Rng): DrawnItem[] {
  const size = Math.min(ROUND_SIZE, bank.items.length);
  const seen = seenItemIds(log);
  const itemIds =
    bank.items.length < ROUND_SIZE
      ? bank.items.map((item) => item.id)
      : pickIds(bank, log, seen, size, rng);
  const drawn = itemIds.map((itemId) => ({ itemId, swapped: rng() < 0.5 }));
  return shuffle(drawn, rng);
}

function quotasFor(rng: Rng): Map<Topic, number> {
  const extraTopics = shuffle([...TOPICS], rng).slice(0, 2);
  const extras = new Set(extraTopics);
  const quotas = new Map<Topic, number>();
  for (const topic of TOPICS) {
    quotas.set(topic, 3 + (extras.has(topic) ? 1 : 0));
  }
  return quotas;
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
  const quotas = quotasFor(rng);

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
