import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CalibrationBank } from './calibration.models';
import { QuizManifestEntry } from '../../core/models/quiz.models';

@Injectable({ providedIn: 'root' })
export class CalibrationBankService {
  private readonly http: HttpClient = inject(HttpClient);

  loadBank(entry: QuizManifestEntry): Observable<CalibrationBank> {
    const base = entry.dataPath.endsWith('/') ? entry.dataPath : `${entry.dataPath}/`;
    return this.http.get<CalibrationBank>(`${base}items.json`);
  }
}
