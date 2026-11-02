import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PracticeService } from './practice.service';
import { StatsService } from './stats.service';
import { PRACTICE_KEY } from '../models/practice.models';
import { provideFixedClock } from '../../../testing/fixed-clock';
import { MemoryStorage } from '../../../testing/memory-storage';

/** Local noon, so the local calendar date is the same in every time zone the suite runs in. */
function local(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

function setup(clockAt: Date = local(2026, 11, 2)): PracticeService {
  TestBed.configureTestingModule({ providers: [provideFixedClock(clockAt.toISOString())] });
  return TestBed.inject(PracticeService);
}

function stored(store: MemoryStorage): Record<string, unknown> | null {
  const raw = store.getItem(PRACTICE_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

describe('PracticeService', () => {
  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('first practice', () => {
    it('does not qualify a day below five scored answers', () => {
      const service = setup();
      const snap = service.recordAttempt('reasoning-traps', { conceptIds: ['anchoring'] }, local(2026, 11, 2));

      expect(snap.attemptsToday).toBe(1);
      expect(snap.practicedToday).toBe(false);
      expect(snap.streak).toBe(0);
    });

    it('starts a streak of one on the fifth scored answer and grants the first rest day', () => {
      const service = setup();
      const day = local(2026, 11, 2);
      for (let i = 0; i < 4; i += 1) service.recordAttempt('reasoning-traps', {}, day);
      const snap = service.recordAttempt('reasoning-traps', {}, day);

      expect(snap.practicedToday).toBe(true);
      expect(snap.streak).toBe(1);
      expect(snap.longest).toBe(1);
      expect(snap.restDays).toBe(1);
      expect(snap.attemptsToday).toBe(5);
    });

    it('stamps lastPlayedAt for the quiz with the given instant', () => {
      const service = setup();
      const at = local(2026, 11, 2, 9, 30);
      service.recordAttempt('biases', {}, at);

      expect(service.lastPlayed()).toEqual({ biases: at.toISOString() });
    });
  });

  describe('idempotence on the same day', () => {
    it('a second qualification on the same day leaves the streak at one', () => {
      const service = setup();
      const day = local(2026, 11, 2);
      service.recordAttempt('biases', { count: 5 }, day);
      const snap = service.recordAttempt('biases', { count: 5 }, local(2026, 11, 2, 18));

      expect(snap.streak).toBe(1);
      expect(snap.longest).toBe(1);
    });

    it('a daily puzzle on a day already qualified does not add a second day', () => {
      const service = setup();
      const day = local(2026, 11, 2);
      service.recordAttempt('biases', { count: 5 }, day);
      const snap = service.recordDaily(local(2026, 11, 2, 20));

      expect(snap.streak).toBe(1);
    });

    it('recordDaily alone qualifies the day', () => {
      const service = setup();
      const snap = service.recordDaily(local(2026, 11, 2));

      expect(snap.practicedToday).toBe(true);
      expect(snap.streak).toBe(1);
    });

    it('consecutive qualifying days extend the streak', () => {
      const service = setup();
      service.recordAttempt('biases', { count: 5 }, local(2026, 11, 2));
      const snap = service.recordAttempt('biases', { count: 5 }, local(2026, 11, 3));

      expect(snap.streak).toBe(2);
      expect(snap.longest).toBe(2);
    });
  });

  describe('threshold', () => {
    it('count sums toward the five-answer threshold across calls', () => {
      const service = setup();
      const day = local(2026, 11, 2);
      service.recordAttempt('reasoning-traps', { count: 3 }, day);
      const snap = service.recordAttempt('confidence-calibration', { count: 2 }, day);

      expect(snap.attemptsToday).toBe(5);
      expect(snap.practicedToday).toBe(true);
    });

    it('wrong answers count, so the call does not need correct answers to qualify', () => {
      const service = setup();
      const snap = service.recordAttempt('fallacies', { conceptIds: ['ad-hominem'], count: 5 }, local(2026, 11, 2));

      expect(snap.practicedToday).toBe(true);
    });
  });

  describe('midnight rollover', () => {
    it('resets today attempts when the local date changes, and the streak continues', () => {
      const service = setup();
      service.recordAttempt('biases', { count: 4 }, local(2026, 11, 2, 23, 55));
      const after = service.recordAttempt('biases', { count: 1 }, local(2026, 11, 3, 0, 5));

      expect(after.attemptsToday).toBe(1);
      expect(after.practicedToday).toBe(false);

      const day2 = service.recordAttempt('biases', { count: 4 }, local(2026, 11, 3, 0, 10));
      expect(day2.practicedToday).toBe(true);
      expect(day2.streak).toBe(2);
    });
  });

  describe('corrupt or unknown state', () => {
    it('corrupt JSON reads as zeroed and does not throw', () => {
      store.setItem(PRACTICE_KEY, '{not json');
      const service = setup();

      expect(() => service.snapshot()).not.toThrow();
      const snap = service.snapshot();
      expect(snap).toEqual({
        enabled: true,
        streak: 0,
        longest: 0,
        restDays: 0,
        practicedToday: false,
        attemptsToday: 0,
      });
    });

    it('an unknown version reads as zeroed and is not persisted by a read', () => {
      const future = JSON.stringify({ version: 2, enabled: false, streak: { current: 9, longest: 9 } });
      store.setItem(PRACTICE_KEY, future);
      const service = setup();
      const snap = service.snapshot();

      expect(snap.enabled).toBe(true);
      expect(snap.streak).toBe(0);
      expect(store.getItem(PRACTICE_KEY)).toBe(future);
    });

    it('a type-mismatched field is replaced with its default on the next write', () => {
      store.setItem(PRACTICE_KEY, JSON.stringify({ version: 1, enabled: 'yes', streak: 'oops' }));
      const service = setup();

      expect(service.snapshot().enabled).toBe(true);
      service.recordAttempt('biases', { count: 5 }, local(2026, 11, 2));

      const written = stored(store);
      expect(written?.['enabled']).toBe(true);
      expect(typeof written?.['streak']).toBe('object');
    });
  });

  describe('save failure', () => {
    it('sets saveFailed when the write throws, and clears it after a successful write', () => {
      const service = setup();
      const spy = vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => service.recordAttempt('biases', { count: 1 }, local(2026, 11, 2))).not.toThrow();
      expect(service.saveFailed()).toBe(true);

      spy.mockRestore();
      service.recordAttempt('biases', { count: 1 }, local(2026, 11, 2));
      expect(service.saveFailed()).toBe(false);
    });
  });

  describe('enabled', () => {
    it('setEnabled(false) persists and is read back', () => {
      const service = setup();
      service.setEnabled(false);

      expect(stored(store)?.['enabled']).toBe(false);
      expect(service.snapshot().enabled).toBe(false);
    });
  });

  describe('reset interplay', () => {
    it('StatsService.resetAll clears the practice key', () => {
      const service = setup();
      service.recordAttempt('biases', { count: 5 }, local(2026, 11, 2));
      expect(store.getItem(PRACTICE_KEY)).not.toBeNull();

      TestBed.inject(StatsService).resetAll();

      expect(store.getItem(PRACTICE_KEY)).toBeNull();
    });

    it('StatsService.resetQuiz leaves the practice key and streak alone', () => {
      const service = setup();
      service.recordAttempt('biases', { count: 5 }, local(2026, 11, 2));
      TestBed.inject(StatsService).resetQuiz('biases');

      expect(store.getItem(PRACTICE_KEY)).not.toBeNull();
      expect(service.snapshot().streak).toBe(1);
    });
  });

  describe('badges', () => {
    it('recordBadges stores earnedAt once and never overwrites it', () => {
      const service = setup();
      const first = local(2026, 11, 2, 10);
      const second = local(2026, 11, 5, 10);
      service.recordBadges([{ id: 'names-the-trap', evidence: 'first evidence' }], first);
      service.recordBadges([{ id: 'names-the-trap', evidence: 'later evidence' }], second);

      expect(service.badges()).toEqual({
        'names-the-trap': { earnedAt: first.toISOString(), evidence: 'first evidence' },
      });
    });
  });
});
