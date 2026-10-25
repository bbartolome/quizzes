import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

@Component({
  imports: [StatusBadge],
  template: `
    <ui-status tone="success" label="Correct" />
    <ui-status tone="danger" label="Wrong pick" />
    <ui-status tone="warning" label="Missed" />
    <ui-status tone="neutral" label="Not picked" />
  `,
})
class Host {}

function render(): HTMLElement {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function badge(root: HTMLElement, index: number): HTMLElement {
  return root.querySelectorAll<HTMLElement>('ui-status > span')[index];
}

describe('StatusBadge (S3, §7.2, §7.3)', () => {
  it('success renders the success text color with a ✓ glyph and its label', () => {
    const el = badge(render(), 0);
    expect(el.classList).toContain('text-success');
    expect(el.textContent).toContain('✓');
    expect(el.textContent).toContain('Correct');
  });

  it('danger renders the danger text color with a ✗ glyph', () => {
    const el = badge(render(), 1);
    expect(el.classList).toContain('text-danger');
    expect(el.textContent).toContain('✗');
    expect(el.textContent).toContain('Wrong pick');
  });

  it('warning renders the warning text color with a ! glyph', () => {
    const el = badge(render(), 2);
    expect(el.classList).toContain('text-warning');
    expect(el.textContent).toContain('!');
    expect(el.textContent).toContain('Missed');
  });

  it('neutral renders the muted text color with no glyph', () => {
    const el = badge(render(), 3);
    expect(el.classList).toContain('text-muted');
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(el.textContent?.trim()).toBe('Not picked');
  });

  it('marks the glyph aria-hidden so the label is the only text announced', () => {
    const glyph = badge(render(), 0).querySelector('[aria-hidden="true"]');
    expect(glyph?.textContent).toBe('✓');
  });
});
