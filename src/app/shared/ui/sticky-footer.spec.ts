import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StickyFooter } from './sticky-footer';

@Component({
  imports: [StickyFooter],
  template: `
    <ui-sticky-footer>
      <span class="score">3 of 5 correct</span>
      <button actions class="action">End quiz</button>
    </ui-sticky-footer>
  `,
})
class Host {}

function render(): HTMLElement {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function footer(root: HTMLElement): HTMLElement {
  const el = root.querySelector<HTMLElement>('ui-sticky-footer');
  if (!el) {
    throw new Error('no ui-sticky-footer');
  }
  return el;
}

describe('StickyFooter (S3, §7.2)', () => {
  it('puts the sticky classes on the host, which is the shell column child', () => {
    const classes = [...footer(render()).classList];
    expect(classes).toEqual(
      expect.arrayContaining([
        'sticky',
        'bottom-0',
        'mt-auto',
        'flex',
        'items-center',
        'justify-between',
        'gap-4',
        'border-t',
        'border-default',
        'bg-raised/95',
        'px-4',
        'py-3',
        'backdrop-blur',
      ]),
    );
  });

  it('has no wrapper element, so sticky is not constrained to an inner box', () => {
    expect(footer(render()).querySelector(':scope > div')).toBeNull();
  });

  it('projects the score into the default slot', () => {
    expect(footer(render()).querySelector('.score')?.textContent).toBe('3 of 5 correct');
  });

  it('projects the actions into the [actions] slot, after the score', () => {
    const el = footer(render());
    const score = el.querySelector('.score') as HTMLElement;
    const action = el.querySelector('button.action') as HTMLElement;
    expect(action.textContent?.trim()).toBe('End quiz');
    expect(score.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
