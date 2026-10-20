import { z } from 'zod';
import type { Question } from '@/config/questions';
import { containsProfanity } from './profanity';

export const NAME_MAX = 30;
export const DEPARTMENT_MAX = 40;

/** Trimmed, single-spaced, 1..max chars, profanity-checked text field. */
function textField(label: string, max: number, rude: string) {
  return z
    .string()
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(1, `Please enter your ${label}`)
        .max(max, `Keep it under ${max} characters`)
        .refine((s) => !containsProfanity(s), rude),
    );
}

export const nameSchema = textField('name', NAME_MAX, 'Please choose a different name');
export const departmentSchema = textField('department', DEPARTMENT_MAX, 'Please enter a different department');

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

export function validateName(input: string): NameResult {
  const r = nameSchema.safeParse(input);
  if (r.success) return { ok: true, name: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? 'Invalid name' };
}

export type Registration = { name: string; department: string };
export type RegistrationResult =
  | { ok: true; data: Registration }
  | { ok: false; errors: Partial<Record<keyof Registration, string>> };

export function validateRegistration(input: Registration): RegistrationResult {
  const name = nameSchema.safeParse(input.name);
  const department = departmentSchema.safeParse(input.department);
  if (name.success && department.success) return { ok: true, data: { name: name.data, department: department.data } };
  return {
    ok: false,
    errors: {
      name: name.success ? undefined : (name.error.issues[0]?.message ?? 'Invalid name'),
      department: department.success ? undefined : (department.error.issues[0]?.message ?? 'Invalid department'),
    },
  };
}

export type Answers = Record<string, string[]>;

/** Every question answered, only known option ids, no duplicates, within maxSelect. */
export function validateAnswers(answers: Answers, questions: Question[]): string | null {
  const known = new Set(questions.map((q) => q.id));
  for (const id of Object.keys(answers)) {
    if (!known.has(id)) return `Unknown question ${id}`;
  }
  for (const q of questions) {
    const picked = answers[q.id] ?? [];
    if (picked.length === 0) return `Please answer: ${q.text}`;
    if (picked.length > q.maxSelect) return `Pick up to ${q.maxSelect} for: ${q.text}`;
    if (new Set(picked).size !== picked.length) return 'Duplicate selection';
    const ids = new Set(q.options.map((o) => o.id));
    if (picked.some((p) => !ids.has(p))) return `Unknown option for ${q.id}`;
  }
  return null;
}
