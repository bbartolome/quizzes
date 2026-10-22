import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import {
  KnowledgeBase,
  Question,
  QuizManifest,
  QuizManifestEntry,
  requireDataPath,
  Template,
} from '../models/quiz.models';

export interface QuizBundle {
  questions: Question[];
  templates: Template[];
  knowledgeBase: KnowledgeBase;
}

// Fixed app-level path (spec §2.1); never taken from a manifest dataPath.
const KNOWLEDGE_BASE_PATH = 'data/concepts/knowledge-base.json';

@Injectable({ providedIn: 'root' })
export class QuizDataService {
  private readonly http: HttpClient = inject(HttpClient);

  loadManifest(): Observable<QuizManifest> {
    return this.http.get<QuizManifest>('data/quizzes.json');
  }

  loadQuizBundle(entry: QuizManifestEntry): Observable<QuizBundle> {
    const dataPath = requireDataPath(entry);
    const base = dataPath.endsWith('/') ? dataPath : `${dataPath}/`;
    return forkJoin({
      questions: this.http.get<Question[]>(`${base}questions.json`),
      templates: this.http.get<Template[]>(`${base}templates.json`),
      knowledgeBase: this.http.get<KnowledgeBase>(KNOWLEDGE_BASE_PATH),
    }).pipe(
      map(({ questions, templates, knowledgeBase }) => ({ questions, templates, knowledgeBase })),
    );
  }
}
