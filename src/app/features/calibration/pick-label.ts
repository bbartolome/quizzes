import { CalibrationItem, CalibrationPick, isFourWayItem } from './calibration.models';

export function pickLabel(item: CalibrationItem, pick: CalibrationPick): string {
  if (Array.isArray(pick)) {
    const [a, b] = pick;
    if (!a && !b) return 'Neither';
    if (a && !b) return item.options[0];
    if (!a && b) return item.options[1];
    return 'Both';
  }
  return item.options[pick];
}

export function correctPick(item: CalibrationItem): CalibrationPick {
  return isFourWayItem(item) ? item.truth : item.correct;
}
