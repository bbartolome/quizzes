import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuizDataService } from './quiz-data.service';
import {
  QuizManifest,
  QuizManifestEntry,
  Question,
  Template,
  KnowledgeBaseEntry,
} from '../models/quiz.models';

describe('QuizDataService', () => {
  let service: QuizDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(QuizDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('loadManifest', () => {
    it('GETs the manifest from a relative, leading-slash-free path', (): void => {
      const manifest: QuizManifest = {
        quizzes: [
          {
            id: 'reasoning-traps',
            title: 'Reasoning Traps',
            description: 'Spot logical fallacies and cognitive biases in everyday claims.',
            icon: 'icons/reasoning-traps.svg',
            accent: '#3b6ea5',
            version: 1,
            dataPath: 'data/quizzes/reasoning-traps/',
            order: 1,
          },
        ],
      };

      let result: QuizManifest | undefined;
      service.loadManifest().subscribe((value) => (result = value));

      const req = httpMock.expectOne('data/quizzes.json');
      expect(req.request.method).toBe('GET');
      expect(req.request.url.startsWith('/')).toBe(false);

      req.flush(manifest);

      expect(result).toEqual(manifest);
    });
  });

  describe('loadQuizBundle', () => {
    it('GETs questions, templates, and knowledge base from the entry dataPath and combines them', () => {
      const entry: QuizManifestEntry = {
        id: 'reasoning-traps',
        title: 'Reasoning Traps',
        description: 'Spot logical fallacies and cognitive biases in everyday claims.',
        icon: 'icons/reasoning-traps.svg',
        accent: '#3b6ea5',
        version: 1,
        dataPath: 'data/quizzes/reasoning-traps/',
        order: 1,
      };

      const questions: Question[] = [
        {
          id: 'q01',
          prompt: 'Example prompt',
          options: ['A', 'B'],
          correctAnswers: ['A'],
          category: 'fallacy',
          tags: ['strawman'],
          explanation: 'Because A.',
          difficulty: 1,
        },
      ];

      const templates: Template[] = [
        {
          id: 't01',
          pattern: 'A pattern with {slot}.',
          slots: { slot: ['value'] },
          correctAnswers: ['value'],
          distractors: ['other'],
          category: 'bias',
          explanation: 'Because value.',
        },
      ];

      const knowledgeBase: KnowledgeBaseEntry[] = [
        {
          id: 'strawman',
          name: 'Straw Man',
          type: 'fallacy',
          shortDefinition: 'Misrepresenting an argument.',
          longExplanation: 'A longer explanation.',
          example: 'An example.',
          commonlyConfusedWith: ['ad-hominem'],
          distinguishingTip: 'Look for the misrepresentation.',
        },
      ];

      let result: { questions: Question[]; templates: Template[]; knowledgeBase: KnowledgeBaseEntry[] } | undefined;
      service.loadQuizBundle(entry).subscribe((value) => (result = value));

      const questionsReq = httpMock.expectOne(`${entry.dataPath}questions.json`);
      const templatesReq = httpMock.expectOne(`${entry.dataPath}templates.json`);
      const knowledgeBaseReq = httpMock.expectOne(`${entry.dataPath}knowledge-base.json`);

      expect(questionsReq.request.method).toBe('GET');
      expect(templatesReq.request.method).toBe('GET');
      expect(knowledgeBaseReq.request.method).toBe('GET');

      questionsReq.flush(questions);
      templatesReq.flush(templates);
      knowledgeBaseReq.flush(knowledgeBase);

      expect(result).toEqual({ questions, templates, knowledgeBase });
    });
  });
});
