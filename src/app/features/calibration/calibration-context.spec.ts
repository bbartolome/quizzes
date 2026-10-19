import { describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { CalibrationBank } from './calibration.models';
import { CalibrationContext, loadCalibrationContext } from './calibration-context';

const entry = (overrides: Partial<QuizManifestEntry> = {}): QuizManifestEntry => ({
  id: 'cal-1',
  title: 'Calibration',
  description: 'desc',
  icon: 'x',
  accent: 'blue',
  version: 3,
  dataPath: 'data/cal-1',
  order: 1,
  kind: 'calibration',
  ...overrides,
});

const bank: CalibrationBank = { version: 3, items: [] };

function setup(entries: QuizManifestEntry[], bankResult: Observable<CalibrationBank> = of(bank)) {
  const quizData = { loadManifest: vi.fn(() => of({ quizzes: entries })) };
  const bankService = { loadBank: vi.fn(() => bankResult) };
  const history = { migrate: vi.fn() };
  const run = (id: string) =>
    loadCalibrationContext(id, quizData, bankService, history as never);
  return { quizData, bankService, history, run };
}

function readSync(source: Observable<CalibrationContext>) {
  let value: CalibrationContext | undefined;
  let error: unknown;
  source.subscribe({ next: (v) => (value = v), error: (e) => (error = e) });
  return { value, error };
}

describe('loadCalibrationContext', () => {
  it('emits quizId, entry, bank and format synchronously', () => {
    const e = entry({ format: 'two-way' });
    const { run, bankService } = setup([e]);
    const { value } = readSync(run('cal-1'));
    expect(value).toEqual({ quizId: 'cal-1', entry: e, bank, format: 'two-way' });
    expect(bankService.loadBank).toHaveBeenCalledWith(e);
  });

  it('takes format from a four-way entry', () => {
    const { run } = setup([entry({ format: 'four-way' })]);
    expect(readSync(run('cal-1')).value?.format).toBe('four-way');
  });

  it('defaults to two-way when the entry has no format', () => {
    const { run } = setup([entry()]);
    expect(readSync(run('cal-1')).value?.format).toBe('two-way');
  });

  it('migrates once with (quizId, bank, entry.version)', () => {
    const { run, history } = setup([entry({ version: 7 })]);
    readSync(run('cal-1'));
    expect(history.migrate).toHaveBeenCalledTimes(1);
    expect(history.migrate).toHaveBeenCalledWith('cal-1', bank, 7);
  });

  it('errors for an unknown id without loading the bank', () => {
    const { run, bankService, history } = setup([entry()]);
    const { value, error } = readSync(run('nope'));
    expect(value).toBeUndefined();
    expect(error).toBeDefined();
    expect(bankService.loadBank).not.toHaveBeenCalled();
    expect(history.migrate).not.toHaveBeenCalled();
  });

  it('errors for a traps entry', () => {
    const { run, bankService } = setup([entry({ id: 't1', kind: 'traps' })]);
    const { value, error } = readSync(run('t1'));
    expect(value).toBeUndefined();
    expect(error).toBeDefined();
    expect(bankService.loadBank).not.toHaveBeenCalled();
  });

  it('propagates loadBank errors and does not migrate', () => {
    const boom = new Error('offline');
    const { run, history } = setup([entry()], throwError(() => boom));
    const { value, error } = readSync(run('cal-1'));
    expect(value).toBeUndefined();
    expect(error).toBe(boom);
    expect(history.migrate).not.toHaveBeenCalled();
  });
});
