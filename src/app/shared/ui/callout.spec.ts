import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Callout } from './callout';

@Component({
  imports: [Callout],
  template: `
    <ui-callout label="Tip">Look for the lure.</ui-callout>
    <ui-callout>Plain note.</ui-callout>
  `,
})
class Host {}

function render(): HTMLElement {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function callouts(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('ui-callout > div')];
}

describe('Callout (S3, §7.2)', () => {
  it('renders the accent-subtle fill, rounded-lg and p-4', () => {
    const classes = callouts(render())[0].classList;
    expect(classes).toContain('bg-accent-subtle');
    expect(classes).toContain('rounded-lg');
    expect(classes).toContain('p-4');
  });

  it('renders the body in the detail size and the text color, not muted', () => {
    const classes = callouts(render())[0].classList;
    expect(classes).toContain('text-sm');
    expect(classes).toContain('text-text');
    expect(classes).not.toContain('text-muted');
  });

  it('shows a leading "Tip:" label when label is set', () => {
    const label = callouts(render())[0].querySelector('span');
    expect(label?.textContent?.trim()).toBe('Tip:');
    expect(label?.classList).toContain('font-semibold');
  });

  it('shows no label when label is not set', () => {
    expect(callouts(render())[1].querySelector('span')).toBeNull();
  });

  it('projects its content after the label', () => {
    const [tip, plain] = callouts(render());
    expect(tip.textContent).toContain('Look for the lure.');
    expect(plain.textContent?.trim()).toBe('Plain note.');
  });
});
