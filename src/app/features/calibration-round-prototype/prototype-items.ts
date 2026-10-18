// PROTOTYPE data: a handful of original binary items, in memory only.
export interface ProtoItem {
  id: string;
  prompt: string;
  choices: [string, string];
  answer: 0 | 1;
}

export interface ProtoAnswer {
  choice: 0 | 1 | null;
  confidence: number | null; // 50..100
}

export const CONFIDENCE_LEVELS = [50, 60, 70, 80, 90, 100];

export const PROTO_ITEMS: ProtoItem[] = [
  { id: 'p1', prompt: 'Which is longer?', choices: ['The Danube', 'The Mississippi'], answer: 1 },
  { id: 'p2', prompt: 'Which was founded first?', choices: ['Harvard University', 'The Ottoman Empire'], answer: 1 },
  { id: 'p3', prompt: 'Which has more moons?', choices: ['Saturn', 'Jupiter'], answer: 0 },
  { id: 'p4', prompt: 'Which element is denser?', choices: ['Lead', 'Gold'], answer: 1 },
  { id: 'p5', prompt: 'Which city is further north?', choices: ['Rome', 'New York'], answer: 0 },
  { id: 'p6', prompt: 'Which came first?', choices: ['The fax machine', 'The American Civil War'], answer: 0 },
  { id: 'p7', prompt: 'Which country has the larger population?', choices: ['Nigeria', 'Brazil'], answer: 0 },
  { id: 'p8', prompt: 'Which is taller?', choices: ['The Eiffel Tower', 'The Chrysler Building'], answer: 0 },
  { id: 'p9', prompt: 'Which animal lives longer on average?', choices: ['A horse', 'A goat'], answer: 0 },
  { id: 'p10', prompt: 'Which has more bones?', choices: ['An adult human', 'A newborn human'], answer: 1 },
];

export function emptyAnswers(): ProtoAnswer[] {
  return PROTO_ITEMS.map(() => ({ choice: null, confidence: null }));
}

export function isComplete(a: ProtoAnswer): boolean {
  return a.choice !== null && a.confidence !== null;
}
