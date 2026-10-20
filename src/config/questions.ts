export type Question = {
  id: string;
  text: string;
  maxSelect: number;
  /** label = word shown in the cloud, keep it 1–2 words. */
  options: { id: string; label: string }[];
};

// TBD: final questions from the client. Placeholders below.
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'What word best describes George Steuart to you?',
    maxSelect: 3,
    options: [
      { id: 'a', label: 'Heritage' },
      { id: 'b', label: 'Trust' },
      { id: 'c', label: 'Excellence' },
      { id: 'd', label: 'Family' },
      { id: 'e', label: 'Legacy' },
      { id: 'f', label: 'Pride' },
    ],
  },
  {
    id: 'q2',
    text: 'What drives you at work?',
    maxSelect: 3,
    options: [
      { id: 'a', label: 'Teamwork' },
      { id: 'b', label: 'Growth' },
      { id: 'c', label: 'Impact' },
      { id: 'd', label: 'Learning' },
      { id: 'e', label: 'Customers' },
      { id: 'f', label: 'Passion' },
    ],
  },
  {
    id: 'q3',
    text: 'Which value should guide our next chapter?',
    maxSelect: 2,
    options: [
      { id: 'a', label: 'Innovation' },
      { id: 'b', label: 'Integrity' },
      { id: 'c', label: 'Courage' },
      { id: 'd', label: 'Agility' },
      { id: 'e', label: 'Care' },
    ],
  },
  {
    id: 'q4',
    text: 'How do you feel about the future?',
    maxSelect: 2,
    options: [
      { id: 'a', label: 'Excited' },
      { id: 'b', label: 'Confident' },
      { id: 'c', label: 'Inspired' },
      { id: 'd', label: 'Hopeful' },
      { id: 'e', label: 'Ready' },
    ],
  },
  {
    id: 'q5',
    text: 'What makes us stronger together?',
    maxSelect: 3,
    options: [
      { id: 'a', label: 'Unity' },
      { id: 'b', label: 'Respect' },
      { id: 'c', label: 'Diversity' },
      { id: 'd', label: 'Support' },
      { id: 'e', label: 'Vision' },
      { id: 'f', label: 'Gratitude' },
    ],
  },
];

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function optionLabel(questionId: string, optionId: string): string {
  return getQuestion(questionId)?.options.find((o) => o.id === optionId)?.label ?? optionId;
}
