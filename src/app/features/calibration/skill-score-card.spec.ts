import { describe, it, expect } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SkillScoreCard } from './skill-score-card';
import { ScoreSide } from './score-side';
import { CalibrationFormat } from './calibration.models';

function side(overrides: Partial<ScoreSide> = {}): ScoreSide {
  return {
    skill: 68,
    brier: 0.14,
    meanConfidence: 80,
    percentCorrect: 75,
    overconfidence: 5,
    label: '5 points overconfident',
    ...overrides,
  };
}

describe('SkillScoreCard', () => {
  function render(
    inputs: {
      format?: CalibrationFormat;
      side?: ScoreSide;
      before?: ScoreSide | null;
      delta?: number | null;
    } = {},
  ): ComponentFixture<SkillScoreCard> {
    const fixture = TestBed.createComponent(SkillScoreCard);
    fixture.componentRef.setInput('format', inputs.format ?? 'two-way');
    fixture.componentRef.setInput('side', inputs.side ?? side());
    if (inputs.before !== undefined) fixture.componentRef.setInput('before', inputs.before);
    if (inputs.delta !== undefined) fixture.componentRef.setInput('delta', inputs.delta);
    fixture.detectChanges();
    return fixture;
  }

  const text = (f: ComponentFixture<SkillScoreCard>) =>
    (f.nativeElement as HTMLElement).textContent ?? '';

  it('shows the skill value', () => {
    expect(text(render({ side: side({ skill: 73 }) }))).toContain('73');
  });

  it('formats Brier with two decimals', () => {
    expect(text(render({ side: side({ brier: 0.14 }) }))).toContain('Brier 0.14');
    expect(text(render({ side: side({ brier: 0.1 }) }))).toContain('Brier 0.10');
  });

  it('says guessing scores 50 on two-way', () => {
    expect(text(render({ format: 'two-way' }))).toContain('Guessing scores 50');
  });

  it('says guessing scores 25 on four-way', () => {
    expect(text(render({ format: 'four-way' }))).toContain('Guessing scores 25');
  });

  it('labels the guessing and perfect ticks and the worse-than-guessing zone', () => {
    const t = text(render());
    expect(t).toContain('guessing');
    expect(t).toContain('perfect');
    expect(t).toContain('worse than guessing');
  });

  it('places the marker at the skill score', () => {
    const el = render({ side: side({ skill: 68 }) }).nativeElement as HTMLElement;
    expect(el.querySelector<HTMLElement>('[data-marker]')?.style.left).toBe('68%');
  });

  it('clamps the marker at 0% for negative skill', () => {
    const el = render({ side: side({ skill: -12 }) }).nativeElement as HTMLElement;
    expect(el.querySelector<HTMLElement>('[data-marker]')?.style.left).toBe('0%');
  });

  it('shows the previous score with ▲ for a positive delta', () => {
    const t = text(render({ before: side({ skill: 60 }), delta: 8 }));
    expect(t).toContain('Before this round: 60');
    expect(t).toContain('▲ 8');
  });

  it('shows ▼ for a negative delta', () => {
    const t = text(render({ before: side({ skill: 80 }), delta: -12 }));
    expect(t).toContain('▼ 12');
    expect(t).not.toContain('▲');
  });

  it('hides the before line when there is no before', () => {
    const t = text(render({ before: null, delta: null }));
    expect(t).not.toContain('Before this round');
    expect(t).not.toContain('▲');
    expect(t).not.toContain('▼');
  });

  it('explains scoring in a details element with the 0.04 example', () => {
    const el = render().nativeElement as HTMLElement;
    const details = el.querySelector('details');
    expect(details?.querySelector('summary')?.textContent).toContain('How is this scored?');
    expect(details?.textContent).toContain('0.04');
  });
});
