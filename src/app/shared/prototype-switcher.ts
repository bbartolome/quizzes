// PROTOTYPE switcher: floating bar that cycles ?variant= on the current route.
import { Component, HostListener, inject, input, isDevMode } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export interface PrototypeVariant {
  key: string;
  name: string;
}

@Component({
  selector: 'app-prototype-switcher',
  template: `
    @if (dev) {
      <div
        class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl ring-2 ring-yellow-400"
      >
        <button type="button" class="px-2 text-lg" (click)="step(-1)" aria-label="Previous variant">←</button>
        <span class="font-mono">{{ label() }}</span>
        <button type="button" class="px-2 text-lg" (click)="step(1)" aria-label="Next variant">→</button>
      </div>
    }
  `,
})
export class PrototypeSwitcher {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly variants = input.required<PrototypeVariant[]>();
  readonly current = input.required<string>();
  readonly dev = isDevMode();

  label(): string {
    const v = this.variants().find((x) => x.key === this.current());
    return v ? `${v.key} (${v.name})` : this.current();
  }

  step(delta: number): void {
    const keys = this.variants().map((v) => v.key);
    const i = Math.max(0, keys.indexOf(this.current()));
    const next = keys[(i + delta + keys.length) % keys.length];
    this.router.navigate([], { relativeTo: this.route, queryParams: { variant: next }, replaceUrl: true });
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') this.step(-1);
    if (e.key === 'ArrowRight') this.step(1);
  }
}
