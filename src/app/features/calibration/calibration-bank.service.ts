import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CalibrationBank } from './calibration.models';
import { QuizManifestEntry, requireDataPath } from '../../core/models/quiz.models';

@Injectable({ providedIn: 'root' })
export class CalibrationBankService {
  private readonly http: HttpClient = inject(HttpClient);

  loadBank(entry: QuizManifestEntry): Observable<CalibrationBank> {
    const dataPath = requireDataPath(entry);
    const base = dataPath.endsWith('/') ? dataPath : `${dataPath}/`;
    return this.http.get<CalibrationBank>(`${base}items.json`);
  }
}
