import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BankUnavailable } from './bank-unavailable';

describe('BankUnavailable', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BankUnavailable] });
  });

  it('renders the exact unavailable message', () => {
    const fixture = TestBed.createComponent(BankUnavailable);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      "Couldn't load this quiz. Check your connection and try again.",
    );
  });

  it('renders the message in an EmptyState', () => {
    const fixture = TestBed.createComponent(BankUnavailable);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-empty-state')).not.toBeNull();
  });

  it('renders Retry as a secondary Button', () => {
    const fixture = TestBed.createComponent(BankUnavailable);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.hasAttribute('uiButton')).toBe(true);
    expect(button.className).toContain('border-strong');
  });

  it('renders a Retry button', () => {
    const fixture = TestBed.createComponent(BankUnavailable);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent?.trim()).toBe('Retry');
  });

  it('emits retry when Retry is clicked', () => {
    const fixture = TestBed.createComponent(BankUnavailable);
    fixture.detectChanges();
    const handler = vi.fn();
    fixture.componentInstance.retry.subscribe(handler);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
