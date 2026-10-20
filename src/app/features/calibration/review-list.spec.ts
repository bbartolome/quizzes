import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewList } from './review-list';
import type { ReviewRow, ReviewSection } from './review-sections';

function row(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    itemId: 'i1',
    prompt: 'Which is larger?',
    confidence: 90,
    pickLabel: 'Alpha',
    correctLabel: 'Beta',
    facts: ['Beta is larger than Alpha.'],
    source: { label: 'Atlas', url: 'https://example.com/atlas' },
    flags: [],
    ...overrides,
  };
}

function section(overrides: Partial<ReviewSection> = {}): ReviewSection {
  return { group: 'confident-miss', title: 'Confident misses', open: true, rows: [row()], ...overrides };
}

describe('ReviewList', () => {
  let fixture: ComponentFixture<ReviewList>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(sections: ReviewSection[]) {
    fixture.componentRef.setInput('sections', sections);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReviewList] });
    fixture = TestBed.createComponent(ReviewList);
  });

  it('renders one details per section with "Title (n)" summary', () => {
    render([
      section({ rows: [row(), row({ itemId: 'i2' })] }),
      section({ group: 'confident-hit', title: 'Confident hits', open: false, rows: [row({ itemId: 'i3', correctLabel: null })] }),
    ]);

    const summaries = Array.from(el().querySelectorAll('details > summary')).map((s) => s.textContent?.trim());
    expect(summaries).toEqual(['Confident misses (2)', 'Confident hits (1)']);
  });

  it('opens each details according to section.open', () => {
    render([section(), section({ group: 'underplayed-hit', title: 'Underplayed hits', open: false })]);

    const details = Array.from(el().querySelectorAll('details'));
    expect(details.map((d) => d.open)).toEqual([true, false]);
  });

  it('shows confidence, prompt and the player answer', () => {
    render([section()]);

    const text = el().textContent ?? '';
    expect(text).toContain('90%');
    expect(text).toContain('Which is larger?');
    expect(text).toContain('Your answer: Alpha');
  });

  it('shows the correct answer on a miss', () => {
    render([section()]);

    expect(el().textContent).toContain('Correct answer: Beta');
  });

  it('omits the correct answer on a hit', () => {
    render([section({ rows: [row({ correctLabel: null })] })]);

    expect(el().textContent).not.toContain('Correct answer');
  });

  it('renders every fact', () => {
    render([section({ rows: [row({ facts: ['Fact one.', 'Fact two.'] })] })]);

    const text = el().textContent ?? '';
    expect(text).toContain('Fact one.');
    expect(text).toContain('Fact two.');
  });

  it('renders the source link opening in a new tab', () => {
    render([section()]);

    const link = el().querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com/atlas');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.textContent).toContain('Atlas');
  });

  it('renders the Miss at 100% and Below chance tags', () => {
    render([section({ rows: [row({ flags: ['miss-at-100'] }), row({ itemId: 'i2', flags: ['below-chance'] })] })]);

    const text = el().textContent ?? '';
    expect(text).toContain('Miss at 100%');
    expect(text).toContain('Below chance');
  });

  it('renders no tags for an unflagged row', () => {
    render([section()]);

    const text = el().textContent ?? '';
    expect(text).not.toContain('Miss at 100%');
    expect(text).not.toContain('Below chance');
  });
});
