import type {
  CalibrationBank,
  CalibrationRound,
  PendingPick,
  PendingRound,
} from './calibration.models';
import { drawRound, type Rng } from './draw';

export function setPick(pending: PendingRound, itemId: string, pick: PendingPick): PendingRound {
  return {
    ...pending,
    picks: { ...pending.picks, [itemId]: pick },
  };
}

export function isItemAnswered(pending: PendingRound, itemId: string): boolean {
  const entry = pending.picks[itemId];
  return entry?.pick !== undefined && entry?.confidence !== undefined;
}

export function allItemsAnswered(pending: PendingRound): boolean {
  return (
    pending.items.length > 0 && pending.items.every((item) => isItemAnswered(pending, item.itemId))
  );
}

export function resumeOrDraw(
  existing: PendingRound | null,
  bank: CalibrationBank,
  log: CalibrationRound[],
  rng: Rng,
): { pending: PendingRound; fresh: boolean } {
  if (existing && existing.bankVersion === bank.version) {
    return { pending: existing, fresh: false };
  }
  return {
    pending: {
      bankVersion: bank.version,
      items: drawRound(bank, log, rng),
      picks: {},
    },
    fresh: true,
  };
}
