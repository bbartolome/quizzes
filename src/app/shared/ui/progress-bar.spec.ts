import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './progress-bar';

@Component({
  imports: [ProgressBar],
  template: `<ui-progress [value]="value()" />`,
})
class Host {
  readonly value = signal(0);
}

function render(value: number) {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.value.set(value);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const track = root.querySelector<HTMLElement>('ui-progress > div');
  const fill = track?.querySelector<HTMLElement>('div');
  return { track, fill };
}

describe('ProgressBar (S3, §7.2)', () => {
  it('renders a sunken rounded track with the full width and hidden overflow', () => {
    const { track } = render(50);
    expect(track?.classList).toContain('h-2');
    expect(track?.classList).toContain('w-full');
    expect(track?.classList).toContain('overflow-hidden');
    expect(track?.classList).toContain('rounded-full');
    expect(track?.classList).toContain('bg-sunken');
  });

  it('renders the accent fill, full height and rounded', () => {
    const { fill } = render(50);
    expect(fill?.classList).toContain('h-full');
    expect(fill?.classList).toContain('rounded-full');
    expect(fill?.classList).toContain('bg-accent');
  });

  it('sets the fill width from the value at 0', () => {
    expect(render(0).fill?.style.width).toBe('0%');
  });

  it('sets the fill width from the value at 50', () => {
    expect(render(50).fill?.style.width).toBe('50%');
  });

  it('sets the fill width from the value at 100', () => {
    expect(render(100).fill?.style.width).toBe('100%');
  });
});
