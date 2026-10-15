import { describe, it, expect } from 'vitest';
import { TemplateGeneratorService } from './template-generator.service';
import { Template } from '../models/quiz.models';

function makeTemplate(overrides: Partial<Template> & { id: string }): Template {
  return {
    pattern: 'A pattern with no slots.',
    slots: {},
    correctAnswers: ['Correct A'],
    distractors: ['Distractor A', 'Distractor B'],
    category: 'fallacy',
    explanation: `Explanation for ${overrides.id}`,
    ...overrides,
  };
}

describe('TemplateGeneratorService', () => {
  describe('render', () => {
    it('substitutes slot values into the pattern leaving no literal placeholders', () => {
      const service = new TemplateGeneratorService();
      const template = makeTemplate({
        id: 'slotted-1',
        pattern: 'When {name} argued that {claim}, that was a trap.',
        slots: {
          name: ['Alex', 'Jordan', 'Priya'],
          claim: ['the sky is green', 'cats are dogs', 'water is dry'],
        },
      });

      const rendered = service.render(template);

      expect(rendered.prompt).not.toContain('{name}');
      expect(rendered.prompt).not.toContain('{claim}');
      expect(rendered.prompt).not.toMatch(/\{[^}]+\}/);
    });

    it('builds options as the shuffled union of correctAnswers and distractors with no duplicates', () => {
      const service = new TemplateGeneratorService();
      const template = makeTemplate({
        id: 'options-1',
        correctAnswers: ['Correct A', 'Correct B'],
        distractors: ['Distractor A', 'Distractor B', 'Distractor C'],
      });

      const rendered = service.render(template);

      const expectedOptions = [
        'Correct A',
        'Correct B',
        'Distractor A',
        'Distractor B',
        'Distractor C',
      ];
      expect(rendered.options).toHaveLength(expectedOptions.length);
      expect(new Set(rendered.options).size).toBe(rendered.options.length);
      expect([...rendered.options].sort()).toEqual([...expectedOptions].sort());
    });

    it('preserves the template correctAnswers on the rendered question', () => {
      const service = new TemplateGeneratorService();
      const template = makeTemplate({
        id: 'correct-answers-1',
        correctAnswers: ['Correct A', 'Correct B'],
        distractors: ['Distractor A'],
      });

      const rendered = service.render(template);

      expect([...rendered.correctAnswers].sort()).toEqual(['Correct A', 'Correct B'].sort());
    });

    it('produces at least two distinct rendered prompts across many renders of the same template', () => {
      const service = new TemplateGeneratorService();
      const template = makeTemplate({
        id: 'variety-1',
        pattern: '{subject} insisted that {claim}.',
        slots: {
          subject: ['Alex', 'Jordan', 'Priya', 'Sam'],
          claim: ['the plan was flawless', 'no one disagreed', 'the data was fake'],
        },
      });

      const prompts = new Set<string>();
      for (let i = 0; i < 30; i++) {
        prompts.add(service.render(template).prompt);
      }

      expect(prompts.size).toBeGreaterThanOrEqual(2);
    });

    it('tags the rendered question with the source template id', () => {
      const service = new TemplateGeneratorService();
      const template = makeTemplate({ id: 'source-id-1' });

      const rendered = service.render(template);

      expect(rendered.sourceTemplateId).toBe('source-id-1');
    });
  });
});
