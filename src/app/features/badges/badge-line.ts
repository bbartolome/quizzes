// Red-commit stub for P7b. The implementation commit replaces these bodies.
import { Component, input } from '@angular/core';

export type BadgeSurface = 'confidence' | 'practice';

export const KNOWS_LINE = '';

export function resultsLine(
  _surface: BadgeSurface,
  _earned: ReadonlySet<string>,
  _newly: ReadonlySet<string>,
): string | null {
  return null;
}

@Component({
  selector: 'app-badge-line',
  template: '',
})
export class BadgeLine {
  readonly surface = input<BadgeSurface>('practice');
}
