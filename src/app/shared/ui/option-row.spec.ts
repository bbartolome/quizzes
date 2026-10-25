import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { OptionRow } from './option-row';

@Component({
  imports: [OptionRow],
  template: `
    <label uiOption state="idle">Idle</label>
    <label uiOption state="selected">Selected</label>
    <label uiOption state="correct">Correct</label>
    <label uiOption state="wrong">Wrong</label>
    <label uiOption state="missed">Missed</label>
    <label uiOption state="neutral">Neutral</label>
  `,
})
class Host {}

function render(): HTMLElement {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function row(root: HTMLElement, text: string): HTMLElement {
  const el = [...root.querySelectorAll<HTMLElement>('label[uiOption]')].find(
    (node) => node.textContent?.trim() === text,
  );
  if (!el) {
    throw new Error(`no option row "${text}"`);
  }
  return el;
}

describe('OptionRow (S3, §7.1, §7.3, §9)', () => {
  it('shares the base layout and a 1px rounded border on every state', () => {
    const root = render();
    for (const text of ['Idle', 'Selected', 'Correct', 'Wrong', 'Missed', 'Neutral']) {
      expect([...row(root, text).classList]).toEqual(
        expect.arrayContaining(['flex', 'cursor-pointer', 'items-center', 'gap-3', 'p-3', 'border', 'rounded-lg']),
      );
    }
  });

  it('idle and neutral use the default border and no fill', () => {
    const root = render();
    for (const text of ['Idle', 'Neutral']) {
      const classes = [...row(root, text).classList];
      expect(classes).toContain('border-default');
      expect(classes).not.toContain('bg-accent-subtle');
      expect(classes).not.toContain('bg-success-subtle');
    }
  });

  it('selected uses the accent border and accent-subtle fill', () => {
    const classes = [...row(render(), 'Selected').classList];
    expect(classes).toEqual(expect.arrayContaining(['border-accent', 'bg-accent-subtle']));
    expect(classes).not.toContain('border-default');
  });

  it('correct uses the success border and success-subtle fill', () => {
    const classes = [...row(render(), 'Correct').classList];
    expect(classes).toEqual(expect.arrayContaining(['border-success', 'bg-success-subtle']));
  });

  it('wrong uses the danger border and danger-subtle fill', () => {
    const classes = [...row(render(), 'Wrong').classList];
    expect(classes).toEqual(expect.arrayContaining(['border-danger', 'bg-danger-subtle']));
  });

  it('missed uses the warning border and warning-subtle fill', () => {
    const classes = [...row(render(), 'Missed').classList];
    expect(classes).toEqual(expect.arrayContaining(['border-warning', 'bg-warning-subtle']));
  });

  it('shows the focus ring on the row when an input inside it has focus', () => {
    const classes = [...row(render(), 'Idle').classList];
    expect(classes).toEqual(
      expect.arrayContaining([
        'focus-within:ring-2',
        'focus-within:ring-focus',
        'focus-within:ring-offset-2',
        'focus-within:ring-offset-surface',
      ]),
    );
  });
});
