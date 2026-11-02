import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PracticeSnapshot } from '../../core/models/practice.models';
import { PracticeService } from '../../core/services/practice.service';
import { FakePracticeService } from '../../../testing/fake-practice.service';
import { BadgeEvaluation, BadgeEvaluator } from '../badges/badge-evaluator';
import { InsightsList } from './insights-list';

const shown: PracticeSnapshot = {
  enabled: true,
  streak: 0,
  longest: 0,
  restDays: 1,
  practicedToday: false,
  attemptsToday: 0,
};

describe('InsightsList', () => {
  let practice: FakePracticeService;
  let evaluation: BadgeEvaluation;

  function create(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [InsightsList],
      providers: [
        { provide: PracticeService, useValue: practice },
        { provide: BadgeEvaluator, useValue: { evaluate: () => of(evaluation) } },
      ],
    });
    const fixture = TestBed.createComponent(InsightsList);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const items = (root: HTMLElement, testId: string) =>
    [...root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)].map((el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );

  beforeEach(() => {
    practice = new FakePracticeService();
    practice.seed({ snapshot: shown });
    evaluation = { earned: [], newlyEarned: [] };
  });

  it('shows an earned badge with its title and insight', () => {
    evaluation = { earned: ['notices-lookalikes'], newlyEarned: [] };
    const root = create();

    const earned = items(root, 'insight-earned');
    expect(earned).toHaveLength(1);
    expect(earned[0]).toContain('Notices lookalikes');
    expect(earned[0]).toContain('You tell confusable concepts apart.');
  });

  it('shows each unearned criterion as "Can you show…?" after the earned badges', () => {
    evaluation = { earned: ['notices-lookalikes'], newlyEarned: [] };
    const root = create();

    const unearned = items(root, 'insight-unearned');
    expect(unearned).toHaveLength(3);
    for (const line of unearned) {
      expect(line.startsWith('Can you show…?')).toBe(true);
    }
    expect(unearned.join(' ')).toContain('At least 8 of the 16 knowledge-base concepts are Practised');
  });

  it('lists every badge as unearned when none is earned', () => {
    const root = create();

    expect(items(root, 'insight-earned')).toEqual([]);
    expect(items(root, 'insight-unearned')).toHaveLength(4);
  });

  it('is hidden when the practice layer is turned off', () => {
    practice.seed({ snapshot: { ...shown, enabled: false } });
    const root = create();

    expect(root.querySelector('[data-testid="insights-list"]')).toBeNull();
  });
});
