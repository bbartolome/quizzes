import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Chip } from './chip.directive';

@Component({
  imports: [Chip],
  template: `
    <button uiChip type="button">Fallacy</button>
    <button uiChip type="button" state="selected">Bias</button>
    <label uiChip>Anchoring</label>
    <label uiChip state="selected">Straw man</label>
  `,
})
class Host {}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function classesOf(root: HTMLElement, text: string): string[] {
  const el = [...root.querySelectorAll('button, label')].find(
    (node) => node.textContent?.trim() === text,
  );
  return el ? [...el.classList] : [];
}

const FOCUS_RING = ['focus-visible:ring-2', 'ring-focus', 'ring-offset-2', 'ring-offset-surface'];

describe('Chip (S5, §7.1, §7.3, §3.3, §9)', () => {
  it('gives buttons and labels the same pill shape and size', () => {
    const root = render();
    for (const text of ['Fallacy', 'Bias', 'Anchoring', 'Straw man']) {
      expect(classesOf(root, text)).toEqual(
        expect.arrayContaining(['rounded-full', 'px-3', 'py-1.5', 'text-sm', 'font-medium']),
      );
    }
  });

  it('uses the default border and raised background when idle', () => {
    const root = render();
    for (const text of ['Fallacy', 'Anchoring']) {
      expect(classesOf(root, text)).toEqual(
        expect.arrayContaining(['border-default', 'bg-raised']),
      );
    }
  });

  it('uses the §7.3 selected look when selected', () => {
    const root = render();
    for (const text of ['Bias', 'Straw man']) {
      const classes = classesOf(root, text);
      expect(classes).toEqual(expect.arrayContaining(['border-accent', 'bg-accent-subtle']));
      expect(classes).not.toContain('border-default');
    }
  });

  it('never uses the square radii that the §3.3 rule forbids', () => {
    const root = render();
    for (const text of ['Fallacy', 'Bias', 'Anchoring', 'Straw man']) {
      const classes = classesOf(root, text);
      expect(classes).not.toContain('rounded-md');
      expect(classes).not.toContain('rounded-lg');
    }
  });

  it('gives every chip the §9 focus ring', () => {
    const root = render();
    for (const text of ['Fallacy', 'Bias', 'Anchoring', 'Straw man']) {
      expect(classesOf(root, text)).toEqual(expect.arrayContaining(FOCUS_RING));
    }
  });

  // A label chip wraps a visually hidden checkbox, so the label is never :focus-visible itself.
  it('rings a label chip when the input inside it has keyboard focus', () => {
    const root = render();
    for (const text of ['Fallacy', 'Bias', 'Anchoring', 'Straw man']) {
      expect(classesOf(root, text)).toContain('has-focus-visible:ring-2');
    }
  });
});
