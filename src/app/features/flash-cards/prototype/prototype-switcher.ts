// PROTOTYPE — throwaway floating variant switcher. Hidden in production builds.
import { Component, HostListener, inject, input, isDevMode } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-prototype-switcher',
  template: `
    @if (dev) {
      <div
        class="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-fuchsia-700 px-4 py-2 text-sm font-semibold text-white shadow-xl ring-2 ring-fuchsia-300"
      >
        <button type="button" (click)="go(-1)" aria-label="Previous variant">◀</button>
        <span>{{ current() }} ({{ names()[current()] }})</span>
        <button type="button" (click)="go(1)" aria-label="Next variant">▶</button>
      </div>
    }
  `,
})
export class PrototypeSwitcher {
  private readonly router = inject(Router);
  readonly names = input.required<Record<string, string>>();
  readonly current = input.required<string>();
  readonly dev = isDevMode();

  go(step: number): void {
    const keys = Object.keys(this.names());
    const i = (keys.indexOf(this.current()) + step + keys.length) % keys.length;
    this.router.navigate([], { queryParams: { variant: keys[i] }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') this.go(-1);
    if (e.key === 'ArrowRight') this.go(1);
  }
}
