import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatsService } from '../../core/services/stats.service';
import { CalibrationHistoryService } from './calibration-history.service';
import {
  CalibrationBank,
  CalibrationHistory,
  FourWayItem,
  PendingRound,
  TwoWayItem,
} from './calibration.models';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const SOURCE = { label: 'Source', url: 'https://example.com' };

function twoWay(id: string, correct: 0 | 1): TwoWayItem {
  return {
    id,
    prompt: `Prompt ${id}`,
    options: ['First', 'Second'],
    correct,
    topic: 'history',
    fact: `Fact ${id}`,
    source: SOURCE,
  };
}

function fourWay(id: string, truth: [boolean, boolean]): FourWayItem {
  return {
    id,
    prompt: `Prompt ${id}`,
    options: ['Left', 'Right'],
    truth,
    topic: 'science',
    facts: [`Fact ${id} a`, `Fact ${id} b`],
    source: SOURCE,
  };
}

function twoWayBank(version = 1): CalibrationBank {
  return {
    version,
    items: [twoWay('t1', 0), twoWay('t2', 1), twoWay('t3', 0)],
  };
}

function pendingFor(
  bankVersion: number,
  picks: PendingRound['picks'],
): PendingRound {
  return {
    bankVersion,
    items: Object.keys(picks).map((itemId) => ({ itemId, swapped: false })),
    picks,
  };
}

const KEY = 'stats:calibration:quiz-a';

describe('CalibrationHistoryService', () => {
  let storage: MemoryStorage;
  let service: CalibrationHistoryService;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalibrationHistoryService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stored(): CalibrationHistory {
    return JSON.parse(storage.getItem(KEY)!) as CalibrationHistory;
  }

  /** Submits a round of t1 (right at 80), t2 (wrong at 60) under bank v1. */
  function seedRound(quizId = 'quiz-a', bank = twoWayBank(1)): void {
    service.submit(
      quizId,
      bank,
      pendingFor(bank.version, {
        t1: { pick: 0, confidence: 80 },
        t2: { pick: 0, confidence: 60 },
      }),
      new Date('2026-01-01T10:00:00.000Z'),
    );
  }

  describe('empty state', () => {
    it('returns a zeroed history when nothing is stored', () => {
      expect(service.getHistory('quiz-a')).toEqual({
        quizId: 'quiz-a',
        bankVersion: 0,
        log: [],
        summary: { roundsPlayed: 0, brierSum: 0, answerCount: 0 },
        pending: null,
      });
      expect(service.getSummary('quiz-a')).toEqual({
        roundsPlayed: 0,
        brierSum: 0,
        answerCount: 0,
      });
      expect(service.getPending('quiz-a')).toBeNull();
      expect(service.lastRound('quiz-a')).toBeNull();
      expect(service.allAnswers('quiz-a')).toEqual([]);
      expect(service.lifetimeBefore('quiz-a')).toEqual([]);
    });

    it('returns a zeroed history for corrupt JSON', () => {
      storage.setItem(KEY, '{not json');
      const history = service.getHistory('quiz-a');
      expect(history.log).toEqual([]);
      expect(history.pending).toBeNull();
      expect(history.summary.roundsPlayed).toBe(0);
    });

    it('returns a zeroed history for JSON of the wrong shape', () => {
      storage.setItem(KEY, '42');
      expect(service.getHistory('quiz-a').log).toEqual([]);
    });
  });

  describe('pending round', () => {
    it('stores the record under stats:calibration:<quizId>', () => {
      service.savePending(
        'quiz-a',
        pendingFor(1, { t1: { pick: 0, confidence: 70 } }),
      );
      expect(storage.getItem(KEY)).not.toBeNull();
      expect(storage.getItem('stats:calibration:quiz-b')).toBeNull();
    });

    it('round-trips a saved pending round', () => {
      const pending = pendingFor(1, { t1: { pick: 1, confidence: 90 } });
      service.savePending('quiz-a', pending);
      expect(service.getPending('quiz-a')).toEqual(pending);
    });

    it('overwrites an earlier pick when the answer changes', () => {
      service.savePending(
        'quiz-a',
        pendingFor(1, { t1: { pick: 0, confidence: 60 } }),
      );
      service.savePending(
        'quiz-a',
        pendingFor(1, { t1: { pick: 1, confidence: 90 } }),
      );
      expect(service.getPending('quiz-a')?.picks['t1']).toEqual({
        pick: 1,
        confidence: 90,
      });
    });

    it('does not change the summary or log', () => {
      service.savePending(
        'quiz-a',
        pendingFor(1, { t1: { pick: 0, confidence: 60 } }),
      );
      expect(service.getSummary('quiz-a')).toEqual({
        roundsPlayed: 0,
        brierSum: 0,
        answerCount: 0,
      });
      expect(service.getHistory('quiz-a').log).toEqual([]);
    });

    it('discardPending clears the pending round only', () => {
      seedRound();
      service.savePending(
        'quiz-a',
        pendingFor(1, { t3: { pick: 0, confidence: 60 } }),
      );
      service.discardPending('quiz-a');
      expect(service.getPending('quiz-a')).toBeNull();
      expect(service.getSummary('quiz-a').roundsPlayed).toBe(1);
    });
  });

  describe('submit', () => {
    it('scores answers against the bank using bank-order picks', () => {
      const bank = twoWayBank();
      const round = service.submit(
        'quiz-a',
        bank,
        pendingFor(1, {
          t1: { pick: 0, confidence: 80 },
          t2: { pick: 0, confidence: 60 },
        }),
        new Date('2026-01-01T10:00:00.000Z'),
      );
      expect(round.answers).toEqual([
        { itemId: 't1', pick: 0, confidence: 80, correct: true },
        { itemId: 't2', pick: 0, confidence: 60, correct: false },
      ]);
    });

    it('scores four-way picks elementwise', () => {
      const bank: CalibrationBank = {
        version: 1,
        items: [fourWay('f1', [true, false]), fourWay('f2', [false, false])],
      };
      const round = service.submit(
        'quiz-a',
        bank,
        pendingFor(1, {
          f1: { pick: [true, false], confidence: 75 },
          f2: { pick: [false, true], confidence: 25 },
        }),
      );
      expect(round.answers.map((a) => a.correct)).toEqual([true, false]);
    });

    it('appends a round with submittedAt and bankVersion', () => {
      const now = new Date('2026-03-04T05:06:07.000Z');
      const bank = twoWayBank(3);
      const round = service.submit(
        'quiz-a',
        bank,
        pendingFor(3, { t1: { pick: 0, confidence: 100 } }),
        now,
      );
      expect(round.submittedAt).toBe(now.toISOString());
      expect(round.bankVersion).toBe(3);
      expect(service.getHistory('quiz-a').log).toEqual([round]);
      expect(stored().log).toEqual([round]);
    });

    it('updates the summary', () => {
      seedRound();
      const summary = service.getSummary('quiz-a');
      expect(summary.roundsPlayed).toBe(1);
      expect(summary.answerCount).toBe(2);
      // right at 80 → 0.04; wrong at 60 → 0.36
      expect(summary.brierSum).toBeCloseTo(0.4, 10);

      service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t3: { pick: 0, confidence: 100 } }),
      );
      const next = service.getSummary('quiz-a');
      expect(next.roundsPlayed).toBe(2);
      expect(next.answerCount).toBe(3);
      expect(next.brierSum).toBeCloseTo(0.4, 10);
    });

    it('clears the pending round', () => {
      service.savePending(
        'quiz-a',
        pendingFor(1, { t1: { pick: 0, confidence: 80 } }),
      );
      service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t1: { pick: 0, confidence: 80 } }),
      );
      expect(service.getPending('quiz-a')).toBeNull();
      expect(stored().pending).toBeNull();
    });

    it('throws when an item has no pick', () => {
      expect(() =>
        service.submit(
          'quiz-a',
          twoWayBank(),
          pendingFor(1, { t1: { confidence: 80 } }),
        ),
      ).toThrow();
      expect(service.getSummary('quiz-a').roundsPlayed).toBe(0);
    });

    it('throws when an item has no confidence', () => {
      expect(() =>
        service.submit(
          'quiz-a',
          twoWayBank(),
          pendingFor(1, { t1: { pick: 0 } }),
        ),
      ).toThrow();
      expect(service.getHistory('quiz-a').log).toEqual([]);
    });

    it('throws when a drawn item has no entry in picks', () => {
      const pending: PendingRound = {
        bankVersion: 1,
        items: [{ itemId: 't1', swapped: false }],
        picks: {},
      };
      expect(() => service.submit('quiz-a', twoWayBank(), pending)).toThrow();
    });
  });

  describe('reading the log', () => {
    it('lastRound returns the most recent round', () => {
      seedRound();
      const second = service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t3: { pick: 0, confidence: 90 } }),
        new Date('2026-01-02T10:00:00.000Z'),
      );
      expect(service.lastRound('quiz-a')).toEqual(second);
    });

    it('allAnswers flattens every round in order', () => {
      seedRound();
      service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t3: { pick: 0, confidence: 90 } }),
      );
      expect(service.allAnswers('quiz-a').map((a) => a.itemId)).toEqual([
        't1',
        't2',
        't3',
      ]);
    });

    it('lifetimeBefore excludes the last round', () => {
      seedRound();
      service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t3: { pick: 0, confidence: 90 } }),
      );
      expect(service.lifetimeBefore('quiz-a').map((a) => a.itemId)).toEqual([
        't1',
        't2',
      ]);
    });

    it('lifetimeBefore is empty after a single round', () => {
      seedRound();
      expect(service.lifetimeBefore('quiz-a')).toEqual([]);
    });

    it('keeps quizzes separate', () => {
      seedRound('quiz-a');
      expect(service.getSummary('quiz-b').roundsPlayed).toBe(0);
    });
  });

  describe('Reset all progress', () => {
    it('StatsService.resetAll clears the calibration record', () => {
      seedRound();
      service.savePending(
        'quiz-a',
        pendingFor(1, { t3: { pick: 0, confidence: 60 } }),
      );
      expect(storage.getItem(KEY)).not.toBeNull();

      TestBed.inject(StatsService).resetAll();

      expect(storage.getItem(KEY)).toBeNull();
      expect(service.getSummary('quiz-a').roundsPlayed).toBe(0);
      expect(service.getPending('quiz-a')).toBeNull();
    });
  });

  describe('migrate', () => {
    it('leaves history unchanged when the version matches', () => {
      seedRound();
      const before = storage.getItem(KEY);
      const result = service.migrate('quiz-a', twoWayBank(1), 1);
      expect(result).toEqual(service.getHistory('quiz-a'));
      expect(storage.getItem(KEY)).toBe(before);
    });

    it('does not create a record for a quiz that was never played at the same version', () => {
      const result = service.migrate('quiz-a', twoWayBank(0), 0);
      expect(result.log).toEqual([]);
    });

    it('re-scores old answers when the answer key is corrected', () => {
      seedRound();
      // t2 key corrected: option 0 is now right. t1 key unchanged.
      const bank: CalibrationBank = {
        version: 2,
        items: [twoWay('t1', 0), twoWay('t2', 0), twoWay('t3', 0)],
      };
      const result = service.migrate('quiz-a', bank, 2);
      expect(result.log[0].answers.map((a) => a.correct)).toEqual([
        true,
        true,
      ]);
      // right at 80 → 0.04; right at 60 → 0.16
      expect(result.summary.brierSum).toBeCloseTo(0.2, 10);
      expect(stored().log[0].answers[1].correct).toBe(true);
    });

    it('can turn a right answer into a miss', () => {
      seedRound();
      const bank: CalibrationBank = {
        version: 2,
        items: [twoWay('t1', 1), twoWay('t2', 1)],
      };
      const result = service.migrate('quiz-a', bank, 2);
      expect(result.log[0].answers.map((a) => a.correct)).toEqual([
        false,
        false,
      ]);
    });

    it('drops answers for deleted items and rounds left empty', () => {
      seedRound();
      service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t3: { pick: 0, confidence: 90 } }),
      );
      const bank: CalibrationBank = {
        version: 2,
        items: [twoWay('t1', 0)],
      };
      const result = service.migrate('quiz-a', bank, 2);
      expect(result.log).toHaveLength(1);
      expect(result.log[0].answers.map((a) => a.itemId)).toEqual(['t1']);
      expect(service.allAnswers('quiz-a').map((a) => a.itemId)).toEqual([
        't1',
      ]);
    });

    it('never lowers roundsPlayed', () => {
      seedRound();
      service.submit(
        'quiz-a',
        twoWayBank(),
        pendingFor(1, { t3: { pick: 0, confidence: 90 } }),
      );
      const bank: CalibrationBank = { version: 2, items: [twoWay('x', 0)] };
      const result = service.migrate('quiz-a', bank, 2);
      expect(result.log).toEqual([]);
      expect(result.summary.roundsPlayed).toBe(2);
      expect(result.summary.answerCount).toBe(0);
      expect(result.summary.brierSum).toBe(0);
    });

    it('rebuilds the summary from the surviving answers', () => {
      seedRound();
      const bank: CalibrationBank = {
        version: 2,
        items: [twoWay('t1', 0)],
      };
      const result = service.migrate('quiz-a', bank, 2);
      expect(result.summary.answerCount).toBe(1);
      expect(result.summary.brierSum).toBeCloseTo(0.04, 10);
      expect(result.summary.roundsPlayed).toBe(1);
      expect(service.getSummary('quiz-a')).toEqual(result.summary);
    });

    it('stamps the bank version and persists it', () => {
      seedRound();
      const result = service.migrate('quiz-a', twoWayBank(5), 5);
      expect(result.bankVersion).toBe(5);
      expect(stored().bankVersion).toBe(5);
      // a second migrate at the same version is a no-op
      const again = service.migrate('quiz-a', twoWayBank(5), 5);
      expect(again).toEqual(result);
    });

    it('discards a pending round from another bank version', () => {
      seedRound();
      service.savePending(
        'quiz-a',
        pendingFor(1, { t3: { pick: 0, confidence: 60 } }),
      );
      const result = service.migrate('quiz-a', twoWayBank(2), 2);
      expect(result.pending).toBeNull();
      expect(service.getPending('quiz-a')).toBeNull();
    });

    it('keeps a pending round that already matches the new bank version', () => {
      seedRound();
      service.savePending(
        'quiz-a',
        pendingFor(2, { t3: { pick: 0, confidence: 60 } }),
      );
      const result = service.migrate('quiz-a', twoWayBank(2), 2);
      expect(result.pending?.bankVersion).toBe(2);
    });

    it('re-scores four-way answers by truth', () => {
      const v1: CalibrationBank = {
        version: 1,
        items: [fourWay('f1', [true, false])],
      };
      service.submit(
        'quiz-a',
        v1,
        pendingFor(1, { f1: { pick: [true, false], confidence: 75 } }),
      );
      const v2: CalibrationBank = {
        version: 2,
        items: [fourWay('f1', [true, true])],
      };
      const result = service.migrate('quiz-a', v2, 2);
      expect(result.log[0].answers[0].correct).toBe(false);
    });

    describe('stale cache (bank version below manifest version)', () => {
      it('changes and persists nothing', () => {
        seedRound();
        service.savePending(
          'quiz-a',
          pendingFor(1, { t3: { pick: 0, confidence: 60 } }),
        );
        const before = storage.getItem(KEY);

        const bank: CalibrationBank = {
          version: 1,
          items: [twoWay('t1', 1)],
        };
        const result = service.migrate('quiz-a', bank, 2);

        expect(storage.getItem(KEY)).toBe(before);
        expect(result.bankVersion).toBe(1);
        expect(result.log[0].answers).toHaveLength(2);
        expect(result.pending).not.toBeNull();
      });

      it('does not stamp a record that has no history', () => {
        service.migrate('quiz-a', twoWayBank(1), 2);
        expect(storage.getItem(KEY)).toBeNull();
      });
    });
  });
});
