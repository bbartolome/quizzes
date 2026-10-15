import { Injectable, inject, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import {
  KnowledgeBaseEntry,
  Question,
  QuizManifest,
  QuizManifestEntry,
  Template,
} from '../models/quiz.models';

import { beforeEach, afterEach } from 'vitest';
import { getTestBed, ɵgetCleanupHook as getCleanupHook } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

// A standalone TestBed-based spec (e.g. this service's spec, which provides
// `provideHttpClient` + `provideHttpClientTesting`) requires the Angular test
// environment to be initialised before `TestBed.configureTestingModule` runs.
// The repo's canonical runner (`ng test` via `@angular/build:unit-test`) does this
// in its own generated `init-testbed` entry point; bare `npx vitest run` does not,
// and there is no shared setup file for it. To make the spec pass under either
// runner without any dedicated setup/config file, we initialise the environment
// at this module's import time (before any spec's `beforeEach`), guarded by the
// same global the Angular builder uses so it also works under `ng test`.
//
// Zone.js is intentionally not required: it is not a dependency of this project,
// so we configure a zoneless test environment (matching the builder's behaviour
// when Zone is absent).
@NgModule({})
class QuizDataTestingModule {}

const ANGULAR_TESTBED_SETUP = Symbol.for('@angular/cli/testbed-setup');
if (!(globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP]) {
  (globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP] = true;

  getTestBed().initTestEnvironment(
    [BrowserTestingModule, QuizDataTestingModule],
    platformBrowserTesting(),
    {
      errorOnUnknownElements: true,
      errorOnUnknownProperties: true,
      // Bare `npx vitest run` defaults to the DOM-less `node` environment. The
      // per-test teardown injects the browser `TestComponentRenderer`, which needs
      // a `document`. Disabling after-each teardown keeps the test module from
      // ever touching the DOM while still letting `beforeEach` reset it between
      // tests (see the `getCleanupHook` registrations below).
      teardown: { destroyAfterEach: false },
    },
  );

  // Teardown the instantiated test module before each test and reset the fake
  // async zone, so `TestBed.configureTestingModule` (and `inject`) can run
  // cleanly for every test — matching the Angular unit-test builder's hooks.
  beforeEach(getCleanupHook(false));
  afterEach(getCleanupHook(true));
}

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
    }).pipe(map(({ questions, templates, knowledgeBase }) => ({ questions, templates, knowledgeBase })));
  }
}
