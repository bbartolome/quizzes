import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationBank } from './calibration.models';
import { QuizManifestEntry } from '../../core/models/quiz.models';

function entryWith(dataPath: string): QuizManifestEntry {
  return {
    id: 'confidence-calibration',
    title: 'Confidence Calibration',
    description: 'Judge how sure you should be.',
    icon: 'icons/confidence-calibration.svg',
    version: 1,
    dataPath,
    order: 2,
    kind: 'calibration',
    format: 'two-way',
  };
}

const bank: CalibrationBank = {
  version: 1,
  items: [
    {
      id: 'item-1',
      prompt: 'Which is larger?',
      options: ['Alpha', 'Beta'],
      correct: 0,
      topic: 'numbers',
      fact: 'Alpha is larger.',
      source: { label: 'Example', url: 'https://example.com' },
    },
  ],
};

describe('CalibrationBankService', () => {
  let service: CalibrationBankService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CalibrationBankService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs items.json from a dataPath with a trailing slash', () => {
    service.loadBank(entryWith('data/quizzes/confidence-calibration/')).subscribe();

    const req = httpMock.expectOne('data/quizzes/confidence-calibration/items.json');
    expect(req.request.method).toBe('GET');
    req.flush(bank);
  });

  it('GETs items.json from a dataPath without a trailing slash', () => {
    service.loadBank(entryWith('data/quizzes/confidence-calibration')).subscribe();

    const req = httpMock.expectOne('data/quizzes/confidence-calibration/items.json');
    expect(req.request.method).toBe('GET');
    req.flush(bank);
  });

  it('emits the parsed bank', () => {
    let result: CalibrationBank | undefined;
    service
      .loadBank(entryWith('data/quizzes/confidence-calibration/'))
      .subscribe((value) => (result = value));

    httpMock.expectOne('data/quizzes/confidence-calibration/items.json').flush(bank);

    expect(result).toEqual(bank);
  });

  it('propagates an HTTP error to the subscriber', () => {
    let error: unknown;
    let emitted = false;
    service.loadBank(entryWith('data/quizzes/confidence-calibration/')).subscribe({
      next: () => (emitted = true),
      error: (err) => (error = err),
    });

    httpMock
      .expectOne('data/quizzes/confidence-calibration/items.json')
      .flush('nope', { status: 500, statusText: 'Server Error' });

    expect(emitted).toBe(false);
    expect(error).toBeDefined();
    expect((error as { status: number }).status).toBe(500);
  });
});
