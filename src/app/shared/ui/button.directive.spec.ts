import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Button } from './button.directive';

@Component({
  imports: [Button],
  template: `
    <button uiButton>Start</button>
    <button uiButton variant="secondary">Back</button>
    <button uiButton variant="danger">Reset</button>
    <a uiButton variant="link" href="#">Stats</a>
    <button uiButton disabled>Check</button>
  `,
})
class Host {}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function classesOf(root: HTMLElement, text: string): string[] {
  const el = [...root.querySelectorAll('button, a')].find((node) => node.textContent?.trim() === text);
  return el ? [...el.classList] : [];
}

const FOCUS_RING = ['focus-visible:ring-2', 'ring-focus', 'ring-offset-2', 'ring-offset-surface'];

describe('Button (S2, §7.1)', () => {
  it('applies the one shared size to primary, secondary and danger', () => {
    const root = render();
    for (const text of ['Start', 'Back', 'Reset']) {
      expect(classesOf(root, text)).toEqual(expect.arrayContaining(['px-5', 'py-2.5', 'text-sm', 'font-semibold', 'rounded-lg']));
    }
  });

  it('defaults to primary, which fills with the accent', () => {
    expect(classesOf(render(), 'Start')).toContain('bg-accent');
  });

  it('gives secondary the strong border', () => {
    const classes = classesOf(render(), 'Back');
    expect(classes).toContain('border-strong');
  });

  it('fills danger with the danger color', () => {
    expect(classesOf(render(), 'Reset')).toContain('bg-danger');
  });

  it('gives link no padding and no fill, and uses accent text', () => {
    const classes = classesOf(render(), 'Stats');
    expect(classes).toContain('text-accent');
    expect(classes.some((name) => name === 'px-5' || name === 'py-2.5' || name.startsWith('bg-'))).toBe(false);
  });

  it('gives every variant the §9 focus ring', () => {
    const root = render();
    for (const text of ['Start', 'Back', 'Reset', 'Stats']) {
      expect(classesOf(root, text)).toEqual(expect.arrayContaining(FOCUS_RING));
    }
  });

  it('dims and blocks the cursor when disabled', () => {
    const classes = classesOf(render(), 'Check');
    expect(classes).toEqual(expect.arrayContaining(['disabled:opacity-50', 'disabled:cursor-not-allowed']));
  });
});
