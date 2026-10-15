import { Injectable } from '@angular/core';
import { RoundQuestion, Template } from '../models/quiz.models';

function shuffle<T>(input: T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class TemplateGeneratorService {
  render(template: Template): RoundQuestion {
    const prompt = template.pattern.replace(/\{([^}]+)\}/g, (match, key: string) => {
      const slot = template.slots[key];
      if (slot && slot.length > 0) {
        return slot[Math.floor(Math.random() * slot.length)];
      }
      return match;
    });

    const correctAnswers = [...template.correctAnswers];
    const options = shuffle([...new Set([...template.correctAnswers, ...template.distractors])]);

    return {
      id: template.id,
      prompt,
      options,
      correctAnswers,
      explanation: template.explanation,
      sourceTemplateId: template.id,
    };
  }
}
