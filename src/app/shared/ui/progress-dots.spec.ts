import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProgressDots } from './progress-dots';

@Component({
  imports: [ProgressDots],
  template: `
    <ui-progress-dots
      [count]="count"
      [current]="current"
      [answered]="answered"
      (select)="picked.push($event)"
    />
  `,
})
class Host {
  count = 3;
  current = 1;
  answered = [true, false, true];
  picked: number[] = [];
}

function render(host = new Host()) {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.count = host.count;
  fixture.componentInstance.current = host.current;
  fixture.componentInstance.answered = host.answered;
  fixture.detectChanges();
  return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

function dots(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('ui-progress-dots button')];
}

function fillOf(button: HTMLElement): HTMLElement {
  const fill = button.querySelector<HTMLElement>('span');
  if (!fill) {
    throw new Error('no dot span');
  }
  return fill;
}

describe('ProgressDots (S3, §7.2, §7.3, §9)', () => {
  it('renders one button per item with an "Item N" label', () => {
    const { root } = render();
    const labels = dots(root).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });

  it('gives each button a 24px hit area (h-6 w-6)', () => {
    const { root } = render();
    for (const button of dots(root)) {
      expect(button.classList).toContain('h-6');
      expect(button.classList).toContain('w-6');
    }
  });

  it('marks only the current item with aria-current', () => {
    const { root } = render();
    const current = dots(root).map((b) => b.getAttribute('aria-current'));
    expect(current).toEqual([null, 'true', null]);
  });

  it('draws the current dot in accent', () => {
    const { root } = render();
    expect(fillOf(dots(root)[1]).classList).toContain('bg-accent');
  });

  it('draws an answered, non-current dot as a muted fill', () => {
    const { root } = render();
    expect(fillOf(dots(root)[0]).classList).toContain('bg-muted');
  });

  it('draws an unanswered, non-current dot as an outlined border-strong dot', () => {
    const { root } = render({ count: 3, current: 0, answered: [true, false, true], picked: [] } as Host);
    const classes = fillOf(dots(root)[1]).classList;
    expect(classes).toContain('border');
    expect(classes).toContain('border-strong');
    expect(classes).not.toContain('bg-muted');
    expect(classes).not.toContain('bg-accent');
  });

  it('does not use success colors for answered items', () => {
    const { root } = render();
    for (const button of dots(root)) {
      const classes = [...fillOf(button).classList].join(' ');
      expect(classes).not.toMatch(/success/);
    }
  });

  it('emits select with the index of the clicked item', () => {
    const { root, host } = render();
    dots(root)[2].click();
    expect(host.picked).toEqual([2]);
  });
});
