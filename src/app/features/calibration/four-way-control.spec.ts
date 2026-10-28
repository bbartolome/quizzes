import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { FourWayControl } from './four-way-control';

describe('FourWayControl', () => {
  let fixture: ComponentFixture<FourWayControl>;
  let emitted: { choice: string; confidence: number | null }[];

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  const byText = (text: string): HTMLButtonElement | undefined =>
    buttons().find((b) => b.textContent?.trim() === text);

  const click = (text: string): void => {
    const button = byText(text);
    if (!button) throw new Error(`No button "${text}"`);
    button.click();
    fixture.detectChanges();
  };

  const pressed = (): string[] =>
    buttons()
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent?.trim() ?? '');

  const confidences = ['0%', '25%', '50%', '75%', '100%'];

  const setup = (selected?: { choice?: string; confidence?: number }): void => {
    fixture = TestBed.createComponent(FourWayControl);
    fixture.componentRef.setInput('options', ['Platypus', 'Penguin']);
    if (selected) fixture.componentRef.setInput('selected', selected);
    emitted = [];
    fixture.componentInstance.change.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FourWayControl] });
  });

  it('marks the picked choice with the shared selected look', () => {
    setup({ choice: 'a' });
    expect(byText('Platypus')?.className).toContain('bg-accent-subtle');
    expect(byText('Platypus')?.className).not.toContain('indigo');
  });

  it('renders the four choice buttons', () => {
    setup();
    for (const label of ['Neither', 'Platypus', 'Penguin', 'Both']) {
      expect(byText(label)).toBeTruthy();
    }
  });

  it('hides the confidence row until a choice is made', () => {
    setup();
    for (const label of confidences) {
      expect(byText(label)).toBeUndefined();
    }
  });

  it('emits the choice with null confidence when a choice is clicked', () => {
    setup();
    click('Platypus');
    expect(emitted).toEqual([{ choice: 'a', confidence: null }]);
  });

  it('emits choice and confidence when a confidence is tapped', () => {
    setup({ choice: 'a' });
    for (const label of confidences) {
      expect(byText(label)).toBeTruthy();
    }
    click('75%');
    expect(emitted).toEqual([{ choice: 'a', confidence: 75 }]);
  });

  it('shows both selections as pressed', () => {
    setup({ choice: 'both', confidence: 25 });
    expect(pressed().sort()).toEqual(['25%', 'Both']);
  });

  it('emits null confidence and clears the confidence when the choice changes', () => {
    setup({ choice: 'both', confidence: 25 });
    click('Neither');
    expect(emitted).toEqual([{ choice: 'neither', confidence: null }]);

    fixture.componentRef.setInput('selected', { choice: 'neither' });
    fixture.detectChanges();
    expect(pressed()).toEqual(['Neither']);
  });
});
