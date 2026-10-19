import { map, Observable, of, switchMap, throwError } from 'rxjs';
import { QuizManifestEntry } from '../../core/models/quiz.models';
import { QuizDataService } from '../../core/services/quiz-data.service';
import { CalibrationBank, CalibrationFormat } from './calibration.models';
import { CalibrationBankService } from './calibration-bank.service';
import { CalibrationHistoryService } from './calibration-history.service';
import { formatOf } from './calibration-format';

export interface CalibrationContext {
  quizId: string;
  entry: QuizManifestEntry;
  bank: CalibrationBank;
  format: CalibrationFormat;
}

export function loadCalibrationContext(
  quizId: string,
  quizData: Pick<QuizDataService, 'loadManifest'>,
  bankService: Pick<CalibrationBankService, 'loadBank'>,
  history: Pick<CalibrationHistoryService, 'migrate'>,
): Observable<CalibrationContext> {
  return quizData.loadManifest().pipe(
    switchMap((manifest) => {
      const entry = manifest.quizzes.find((q) => q.id === quizId);
      if (!entry || entry.kind !== 'calibration') {
        return throwError(() => new Error(`Unknown calibration quiz ${quizId}`));
      }
      return bankService.loadBank(entry).pipe(
        map((bank) => {
          history.migrate(quizId, bank, entry.version);
          return { quizId, entry, bank, format: formatOf(entry) };
        }),
      );
    }),
  );
}
