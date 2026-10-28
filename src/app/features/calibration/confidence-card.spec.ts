import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ConfidenceCard } from './confidence-card';
import type { ScoreSide } from './score-side';

const side = (overrides: Partial<ScoreSide> = {}): ScoreSide => ({
  skill: 60,
  brier: 0.2,
  meanConfidence: 78.4,
  percentCorrect: 64.6,
  overconfidence: 13.8,
  label: '14 points overconfident',
  ...overrides,
});

function render(s: ScoreSide, before: ScoreSide | null = null) {
  const fixture = TestBed.createComponent(ConfidenceCard);
  fixture.componentRef.setInput('side', s);
  fixture.componentRef.setInput('before', before);
  fixture.detectChanges();
  return fixture;
}

describe('ConfidenceCard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfidenceCard] });
  });

  it('is a raised Card with a type-card heading', () => {
    const fixture = render(side());
    expect(fixture.nativeElement.querySelector('h3')?.className).toContain('type-card');
    expect(fixture.nativeElement.querySelector('[uiCard]')).not.toBeNull();
  });

  it('shows the side label', () => {
    const text = render(side()).nativeElement.textContent;
    expect(text).toContain('14 points overconfident');
  });

  it('shows mean confidence rounded', () => {
    const text = render(side({ meanConfidence: 78.4 })).nativeElement.textContent;
    expect(text).toContain('78%');
    expect(text).not.toContain('78.4');
  });

  it('shows percent correct rounded', () => {
    const text = render(side({ percentCorrect: 64.6 })).nativeElement.textContent;
    expect(text).toContain('65%');
    expect(text).not.toContain('64.6');
  });

  it('omits the before line when before is null', () => {
    const text = render(side()).nativeElement.textContent;
    expect(text).not.toContain('Before this round:');
  });

  it('shows "Before this round:" with the before label when set', () => {
    const before = side({ label: 'well calibrated' });
    const text = render(side(), before).nativeElement.textContent;
    expect(text).toContain('Before this round:');
    expect(text).toContain('well calibrated');
  });

  it('updates when the before input is cleared', () => {
    const fixture = render(side(), side({ label: 'well calibrated' }));
    fixture.componentRef.setInput('before', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Before this round:');
  });
});
