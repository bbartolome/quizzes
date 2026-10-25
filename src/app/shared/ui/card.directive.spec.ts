import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Card } from './card.directive';

@Component({
  imports: [Card],
  template: `
    <section uiCard>Raised</section>
    <section uiCard tone="sunken">Sunken</section>
    <section uiCard interactive>Interactive</section>
    <fieldset uiCard>Field</fieldset>
    <a uiCard href="#">Link</a>
    <ul><li uiCard>Item</li></ul>
  `,
})
class Host {}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function classesOf(root: HTMLElement, selector: string, text: string): string[] {
  const el = [...root.querySelectorAll(selector)].find((node) => node.textContent?.trim() === text);
  return el ? [...el.classList] : [];
}

describe('Card (S2, §7.1)', () => {
  it('defaults to raised: bg-raised, default border, rounded-lg, p-5, shadow-sm', () => {
    expect(classesOf(render(), 'section', 'Raised')).toEqual(
      expect.arrayContaining(['bg-raised', 'border-default', 'rounded-lg', 'p-5', 'shadow-sm']),
    );
  });

  it('sunken: bg-sunken, rounded-lg, p-4, with no border and no shadow', () => {
    const classes = classesOf(render(), 'section', 'Sunken');
    expect(classes).toEqual(expect.arrayContaining(['bg-sunken', 'rounded-lg', 'p-4']));
    expect(classes).not.toContain('border-default');
    expect(classes).not.toContain('shadow-sm');
  });

  it('interactive adds the hover shadow', () => {
    expect(classesOf(render(), 'section', 'Interactive')).toContain('hover:shadow-md');
  });

  it('raised without interactive has no hover shadow', () => {
    expect(classesOf(render(), 'section', 'Raised')).not.toContain('hover:shadow-md');
  });

  it('works on section, fieldset, a and li', () => {
    const root = render();
    expect(classesOf(root, 'fieldset', 'Field')).toContain('bg-raised');
    expect(classesOf(root, 'a', 'Link')).toContain('bg-raised');
    expect(classesOf(root, 'li', 'Item')).toContain('bg-raised');
  });
});
