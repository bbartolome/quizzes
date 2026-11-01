import { InjectionToken } from '@angular/core';

export const APP_CLOCK = new InjectionToken<() => Date>('APP_CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
