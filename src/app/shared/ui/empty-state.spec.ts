import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <ui-empty-state heading="No stats yet" message="Finish a round to see your stats.">
      <button class="action">Start a round</button>
    </ui-empty-state>
  `,
})
class Host {}

function render(): HTMLElement {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('EmptyState (S2, §7.2)', () => {
  it('renders a sunken card with the bg-sunken, rounded-lg and p-4 classes', () => {
    const root = render();
    const card = root.querySelector('ui-empty-state > *');
    expect(card?.classList).toContain('bg-sunken');
    expect(card?.classList).toContain('rounded-lg');
    expect(card?.classList).toContain('p-4');
  });

  it('renders the heading with type-section', () => {
    const heading = render().querySelector('h2');
    expect(heading?.textContent?.trim()).toBe('No stats yet');
    expect(heading?.classList).toContain('type-section');
  });

  it('renders the message with type-detail', () => {
    const message = render().querySelector('.type-detail');
    expect(message?.textContent?.trim()).toBe('Finish a round to see your stats.');
  });

  it('projects the action', () => {
    expect(render().querySelector('button.action')?.textContent?.trim()).toBe('Start a round');
  });

  it('binds messageTestId to the message element (S9)', () => {
    @Component({
      imports: [EmptyState],
      template: `<ui-empty-state heading="Nothing yet" message="Nothing here yet." messageTestId="empty" />`,
    })
    class TestIdHost {}
    TestBed.configureTestingModule({ imports: [TestIdHost] });
    const fixture = TestBed.createComponent(TestIdHost);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="empty"]')?.textContent?.trim(),
    ).toBe('Nothing here yet.');
  });
});
