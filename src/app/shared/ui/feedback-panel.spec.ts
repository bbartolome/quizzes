import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FeedbackPanel } from './feedback-panel';

@Component({
  imports: [FeedbackPanel],
  template: `
    <ui-feedback verdict="correct"><span class="body">Answer: B</span></ui-feedback>
    <ui-feedback verdict="incorrect"><span class="body">Answer: C</span></ui-feedback>
  `,
})
class Host {}

function render(): HTMLElement {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function panels(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('ui-feedback > div')];
}

describe('FeedbackPanel (S3, §7.2)', () => {
  it('renders a sunken panel with bg-sunken, rounded-lg and p-4', () => {
    const classes = panels(render())[0].classList;
    expect(classes).toContain('bg-sunken');
    expect(classes).toContain('rounded-lg');
    expect(classes).toContain('p-4');
  });

  it('has no border and no raised fill', () => {
    const classes = panels(render())[0].classList;
    expect(classes).not.toContain('border-default');
    expect(classes).not.toContain('bg-raised');
  });

  it('correct shows success text, a ✓ glyph and the word "Correct"', () => {
    const verdict = panels(render())[0].querySelector<HTMLElement>('p');
    expect(verdict?.classList).toContain('text-success');
    expect(verdict?.classList).toContain('font-semibold');
    expect(verdict?.textContent).toContain('✓');
    expect(verdict?.textContent).toContain('Correct');
  });

  it('incorrect shows danger text, a ✗ glyph and the word "Incorrect"', () => {
    const verdict = panels(render())[1].querySelector<HTMLElement>('p');
    expect(verdict?.classList).toContain('text-danger');
    expect(verdict?.textContent).toContain('✗');
    expect(verdict?.textContent).toContain('Incorrect');
  });

  it('marks the glyph aria-hidden so the word is the only text announced', () => {
    const glyph = panels(render())[1].querySelector('p [aria-hidden="true"]');
    expect(glyph?.textContent).toBe('✗');
  });

  it('projects the body after the verdict line', () => {
    const body = panels(render())[0].querySelector('.body');
    expect(body?.textContent).toBe('Answer: B');
  });
});
