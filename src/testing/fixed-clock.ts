import { Provider } from '@angular/core';
import { APP_CLOCK } from '../app/core/app-clock';

export function provideFixedClock(iso: string): Provider {
  return { provide: APP_CLOCK, useValue: () => new Date(iso) };
}
