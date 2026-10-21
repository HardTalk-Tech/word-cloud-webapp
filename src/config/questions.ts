export type Question = {
  id: string;
  text: string;
  maxSelect: number;
  /** label = word shown in the cloud, keep it 1–2 words. */
  options: { id: string; label: string }[];
};

/** Build options a, b, c… from a list of labels (ids must stay stable once answers come in). */
function opts(labels: string[]): Question['options'] {
  return labels.map((label, i) => ({ id: String.fromCharCode(97 + i), label }));
}

// Final questions (client-approved). maxSelect = how many answers each person may pick.
export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'What makes GSH strong?',
    maxSelect: 3,
    options: opts([
      'People',
      'Teamwork',
      'Trust',
      'Expertise',
      'Leadership',
      'Quality',
      'Integrity',
      'Resilience',
      'Heritage',
      'Commitment',
    ]),
  },
  {
    id: 'q2',
    text: 'What helped us succeed in H1?',
    maxSelect: 3,
    options: opts([
      'Focus',
      'Planning',
      'Discipline',
      'Dedication',
      'Collaboration',
      'Adaptability',
      'Persistence',
      'Goal-Oriented',
      'Knowledge',
      'Ownership',
    ]),
  },
  {
    id: 'q3',
    text: 'What should we do differently?',
    maxSelect: 3,
    options: opts([
      'Innovate',
      'Simplify',
      'Communicate',
      'Organise',
      'Empower',
      'Upskill',
      'Adapt',
      'Anticipate',
      'Prioritise',
      'Experiment',
    ]),
  },
  {
    id: 'q4',
    text: 'Where should we focus next?',
    maxSelect: 3,
    options: opts([
      'Customers',
      'Markets',
      'Products',
      'Technology',
      'Training',
      'Compliance',
      'Partnerships',
      'Tenders',
      'Distribution',
      'Service',
    ]),
  },
  {
    id: 'q5',
    text: 'What will accelerate our growth in H2?',
    maxSelect: 3,
    options: opts([
      'Execution',
      'Speed',
      'Efficiency',
      'Accountability',
      'Expansion',
      'Investment',
      'Diversification',
      'Coordination',
      'Conversions',
      'Agility',
    ]),
  },
];

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function optionLabel(questionId: string, optionId: string): string {
  return getQuestion(questionId)?.options.find((o) => o.id === optionId)?.label ?? optionId;
}
