import type { FourWayChoice } from './calibration.models';

const FOUR_WAY_BANK: Record<FourWayChoice, [boolean, boolean]> = {
  neither: [false, false],
  a: [true, false],
  b: [false, true],
  both: [true, true],
};

/**
 * Returns the options in on-screen order. When swapped the pair is reversed.
 * A new tuple is returned so the input is never mutated.
 */
export function screenOptions(
  options: [string, string],
  swapped: boolean,
): [string, string] {
  return swapped
    ? [options[1], options[0]]
    : [options[0], options[1]];
}

/**
 * Maps an on-screen side (0 | 1) to the bank side. Swapping flips the side.
 */
export function twoWayBankPick(side: 0 | 1, swapped: boolean): 0 | 1 {
  return swapped ? ((1 - side) as 0 | 1) : side;
}

/**
 * Converts a bank-space pick and confidence into the on-screen selection.
 * A confidence of 50 is a tie and always renders as side 0 at 50%. Otherwise
 * the pick is flipped when the options are swapped. Confidence passes through.
 */
export function twoWayScreenSelection(
  pick: number,
  confidence: number,
  swapped: boolean,
): { side: 0 | 1; confidence: number } {
  if (confidence === 50) {
    return { side: 0, confidence: 50 };
  }
  const side = swapped ? ((1 - pick) as 0 | 1) : (pick as 0 | 1);
  return { side, confidence };
}

/**
 * Maps a four-way choice to its bank-order boolean pair. Swapping exchanges A
 * and B; Neither and Both are symmetric and leave the pair unchanged.
 */
export function fourWayBankPick(
  choice: FourWayChoice,
  swapped: boolean,
): [boolean, boolean] {
  const pair = FOUR_WAY_BANK[choice];
  return swapped ? [pair[1], pair[0]] : [pair[0], pair[1]];
}

/**
 * Inverse of {@link fourWayBankPick}: maps a bank-order boolean pair back to
 * the on-screen four-way choice. Swapping exchanges A and B; Neither and Both
 * are unchanged by the swap.
 */
export function fourWayScreenChoice(
  pick: [boolean, boolean],
  swapped: boolean,
): FourWayChoice {
  const pair = swapped ? [pick[1], pick[0]] : [pick[0], pick[1]];
  if (pair[0] === false && pair[1] === false) {
    return 'neither';
  }
  if (pair[0] === true && pair[1] === false) {
    return 'a';
  }
  if (pair[0] === true && pair[1] === true) {
    return 'both';
  }
  return 'b';
}
