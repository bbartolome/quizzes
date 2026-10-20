import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import {
  KnowledgeBaseEntry,
  Question,
  QuizManifest,
  QuizManifestEntry,
  Template,
} from '../models/quiz.models';

export interface QuizBundle {
  questions: Question[];
  templates: Template[];
  knowledgeBase: KnowledgeBaseEntry[];
}

@Injectable({ providedIn: 'root' })
export class QuizDataService {
  private readonly http: HttpClient = inject(HttpClient);

  loadManifest(): Observable<QuizManifest> {
    return this.http.get<QuizManifest>('data/quizzes.json');
  }

  loadQuizBundle(entry: QuizManifestEntry): Observable<QuizBundle> {
    const base = entry.dataPath.endsWith('/') ? entry.dataPath : `${entry.dataPath}/`;
    return forkJoin({
      questions: this.http.get<Question[]>(`${base}questions.json`),
      templates: this.http.get<Template[]>(`${base}templates.json`),
      knowledgeBase: this.http.get<KnowledgeBaseEntry[]>(`${base}knowledge-base.json`),
    }).pipe(
      map(({ questions, templates, knowledgeBase }) => ({ questions, templates, knowledgeBase })),
    );
  }
}
