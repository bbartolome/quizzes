import { Injectable } from '@angular/core';
import { Question, RoundQuestion, ScoredQuestionResult } from '../models/quiz.models';

export interface QuestionBank {
  questions: Question[];
}

export interface SelectRoundOptions {
  count: number;
  categories?: Question['category'][];
  traitIds?: string[];
  avoidIds?: Set<string>;
  weakTraitWeights?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class QuizEngineService {
  selectRound(bank: QuestionBank, options: SelectRoundOptions): RoundQuestion[] {
    let pool = bank.questions;

    if (options.categories && options.categories.length > 0) {
      pool = pool.filter((q) => options.categories!.includes(q.category));
    }

    if (options.traitIds && options.traitIds.length > 0) {
      pool = pool.filter((q) => q.tags.some((t) => options.traitIds!.includes(t)));
    }

    if (options.avoidIds && options.avoidIds.size > 0) {
      const filtered = pool.filter((q) => !options.avoidIds!.has(q.id));
      if (filtered.length >= options.count) {
        pool = filtered;
      }
    }

    const remaining = pool.map((q) => {
      if (!options.weakTraitWeights) {
        return { question: q, weight: 1 };
      }
      let weight = 1;
      for (const tag of q.tags) {
        weight += options.weakTraitWeights[tag] ?? 0;
      }
      return { question: q, weight };
    });

    const chosen: Question[] = [];
    for (let i = 0; i < options.count && remaining.length > 0; i++) {
      const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = Math.random() * total;
      let index = 0;
      for (let j = 0; j < remaining.length; j++) {
        roll -= remaining[j].weight;
        if (roll < 0) {
          index = j;
          break;
        }
      }
      chosen.push(remaining[index].question);
      remaining.splice(index, 1);
    }

    return chosen.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: [...q.options],
      correctAnswers: [...q.correctAnswers],
      explanation: q.explanation,
    }));
  }

  score(question: RoundQuestion, selected: string[]): ScoredQuestionResult {
    const correctSet = new Set(question.correctAnswers);
    const selectedSet = new Set(selected);
    const missed = question.correctAnswers.filter((a) => !selectedSet.has(a));
    const extra = selected.filter((s) => !correctSet.has(s));
    const correct = question.correctAnswers.length === selected.length && missed.length === 0;
    return { question, selected, correct, missed, extra };
  }
}
