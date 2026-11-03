import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GameTheoryDataService } from './game-theory-data.service';

const BASE = 'data/quizzes/game-theory/';
const CONCEPTS = { version: 1, concepts: [], pairs: [] };
const TUTORIALS = { version: 1, tutorials: [] };
const CHECKS = { version: 1, checks: [] };

describe('GameTheoryDataService', () => {
  let service: GameTheoryDataService;
  let http: HttpTestingController;

  /** The one live request for a URL. forkJoin cancels siblings after a failure, so cancelled ones are skipped. */
  function live(url: string) {
    const requests = http.match(url).filter((r) => !r.cancelled);
    expect(requests).toHaveLength(1);
    return requests[0];
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GameTheoryDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('loads concepts, tutorials and checks together', () => {
    let loaded: unknown;
    service.load().subscribe((data) => (loaded = data));

    live(`${BASE}concepts.json`).flush(CONCEPTS);
    live(`${BASE}tutorials.json`).flush(TUTORIALS);
    live(`${BASE}checks.json`).flush(CHECKS);

    expect(loaded).toEqual({ concepts: CONCEPTS, tutorials: TUTORIALS, checks: CHECKS });
    expect(service.loadFailed()).toBe(false);
  });

  it('sets loadFailed when one file fails, and clears it on retry', () => {
    service.load().subscribe({ error: () => undefined });
    live(`${BASE}concepts.json`).flush(CONCEPTS);
    live(`${BASE}tutorials.json`).flush('down', { status: 500, statusText: 'Server Error' });
    expect(service.loadFailed()).toBe(true);

    service.retry().subscribe({ error: () => undefined });
    expect(service.loadFailed()).toBe(false);
    live(`${BASE}concepts.json`).flush(CONCEPTS);
    live(`${BASE}tutorials.json`).flush(TUTORIALS);
    live(`${BASE}checks.json`).flush(CHECKS);
    expect(service.loadFailed()).toBe(false);
  });
});
