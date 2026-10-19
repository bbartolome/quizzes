import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BipolarScale } from './bipolar-scale';

describe('BipolarScale', () => {
  let fixture: ComponentFixture<BipolarScale>;

  const expectedLabels = [
    'Rome 100%',
    'Rome 90%',
    'Rome 80%',
    'Rome 70%',
    'Rome 60%',
    '50% no idea',
    'New York 60%',
    'New York 70%',
    'New York 80%',
    'New York 90%',
    'New York 100%',
  ];

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  const byLabel = (label: string): HTMLButtonElement => {
    const found = buttons().find((b) => b.getAttribute('aria-label') === label);
    if (!found) throw new Error(`No button with aria-label "${label}"`);
    return found;
  };

  const pressed = (): string[] =>
    buttons()
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.getAttribute('aria-label') ?? '');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BipolarScale] });
    fixture = TestBed.createComponent(BipolarScale);
    fixture.componentRef.setInput('options', ['Rome', 'New York']);
    fixture.detectChanges();
  });

  it('renders 11 buttons left to right with their aria-labels', () => {
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(expectedLabels);
  });

  it('shows both option names as end labels', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Rome');
    expect(text).toContain('New York');
  });

  it('emits side 0 with the confidence when a left stop is clicked', () => {
    const handler = vi.fn();
    fixture.componentInstance.answer.subscribe(handler);

    byLabel('Rome 80%').click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ side: 0, confidence: 80 });
  });

  it('emits side 1 with the confidence when a right stop is clicked', () => {
    const handler = vi.fn();
    fixture.componentInstance.answer.subscribe(handler);

    byLabel('New York 100%').click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ side: 1, confidence: 100 });
  });

  it('emits side 0 at confidence 50 for the no-idea stop', () => {
    const handler = vi.fn();
    fixture.componentInstance.answer.subscribe(handler);

    byLabel('50% no idea').click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ side: 0, confidence: 50 });
  });

  it('marks nothing pressed when there is no selection', () => {
    expect(pressed()).toEqual([]);
  });

  it('marks only the selected right-side stop as pressed', () => {
    fixture.componentRef.setInput('selected', { side: 1, confidence: 70 });
    fixture.detectChanges();

    expect(pressed()).toEqual(['New York 70%']);
  });

  it('marks the middle stop as pressed for a selected 50', () => {
    fixture.componentRef.setInput('selected', { side: 0, confidence: 50 });
    fixture.detectChanges();

    expect(pressed()).toEqual(['50% no idea']);
  });
});
