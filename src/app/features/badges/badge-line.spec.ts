import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PracticeSnapshot } from '../../core/models/practice.models';
import { PracticeService } from '../../core/services/practice.service';
import { FakePracticeService } from '../../../testing/fake-practice.service';
import { BadgeEvaluation, BadgeEvaluator } from './badge-evaluator';
import { BadgeLine, KNOWS_LINE, resultsLine } from './badge-line';

const KNOWS = 'knows-what-it-knows';
const SURE = 'sure-means-sure';
const LOOKALIKES = 'notices-lookalikes';
const TRAP = 'names-the-trap';

const LOOKALIKES_INSIGHT = 'You tell confusable concepts apart.';
const TRAP_INSIGHT = 'You can name what you spot.';
const SURE_INSIGHT = 'Your high-confidence answers hold up.';

describe('resultsLine', () => {
  const none = new Set<string>();

  it('uses the fixed knows-what-it-knows sentence on the confidence surface once earned', () => {
    expect(resultsLine('confidence', new Set([KNOWS]), none)).toBe(KNOWS_LINE);
    expect(KNOWS_LINE).toBe(
      'You showed that your confident answers are right more often than your guesses',
    );
  });

  it('shows the sure-means-sure insight on the confidence surface once earned', () => {
    expect(resultsLine('confidence', new Set([SURE]), none)).toBe(SURE_INSIGHT);
  });

  it('shows nothing on the confidence surface when no relevant badge is earned', () => {
    expect(resultsLine('confidence', new Set([LOOKALIKES, TRAP]), none)).toBeNull();
  });

  it('shows the traps or biases insight only when that badge was just earned', () => {
    expect(resultsLine('practice', none, new Set([LOOKALIKES]))).toBe(LOOKALIKES_INSIGHT);
    expect(resultsLine('practice', none, new Set([TRAP]))).toBe(TRAP_INSIGHT);
    expect(resultsLine('practice', new Set([LOOKALIKES]), none)).toBeNull();
  });

  it('never shows a calibration badge on the practice surface', () => {
    expect(resultsLine('practice', none, new Set([KNOWS, SURE]))).toBeNull();
  });
});

describe('BadgeLine', () => {
  let practice: FakePracticeService;
  let evaluation: BadgeEvaluation;

  function create(surface: 'confidence' | 'practice') {
    TestBed.configureTestingModule({
      imports: [BadgeLine],
      providers: [
        { provide: PracticeService, useValue: practice },
        { provide: BadgeEvaluator, useValue: { evaluate: () => of(evaluation) } },
      ],
    });
    const fixture = TestBed.createComponent(BadgeLine);
    fixture.componentRef.setInput('surface', surface);
    fixture.detectChanges();
    return fixture;
  }

  const lineText = (root: HTMLElement) =>
    root.querySelector('[data-testid="badge-line"]')?.textContent?.trim() ?? null;

  beforeEach(() => {
    practice = new FakePracticeService();
    evaluation = { earned: [], newlyEarned: [] };
  });

  it('renders the knows-what-it-knows line on the confidence surface', () => {
    evaluation = { earned: [KNOWS], newlyEarned: [KNOWS] };
    const fixture = create('confidence');

    expect(lineText(fixture.nativeElement)).toBe(KNOWS_LINE);
  });

  it('renders the traps insight on the practice surface only when newly earned', () => {
    evaluation = { earned: [TRAP], newlyEarned: [] };
    expect(lineText(create('practice').nativeElement)).toBeNull();

    TestBed.resetTestingModule();
    evaluation = { earned: [TRAP], newlyEarned: [TRAP] };
    expect(lineText(create('practice').nativeElement)).toBe(TRAP_INSIGHT);
  });

  it('renders nothing when the layer is hidden', () => {
    const hidden: PracticeSnapshot = {
      enabled: false,
      streak: 0,
      longest: 0,
      restDays: 0,
      practicedToday: false,
      attemptsToday: 0,
    };
    practice.seed({ snapshot: hidden });
    evaluation = { earned: [KNOWS], newlyEarned: [KNOWS] };

    expect(lineText(create('confidence').nativeElement)).toBeNull();
  });
});
