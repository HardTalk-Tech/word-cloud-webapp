import { describe, expect, it } from 'vitest';
import { PORTRAIT_TOP_BIAS, centreCrop, normaliseCrop, stepDownSizes } from '@/lib/image/resize';
import { containsProfanity } from '@/lib/profanity';
import { validateAnswers, validateName, validateRegistration } from '@/lib/validation';
import { emailToUsername, isOperatorEmail, usernameToEmail } from '@/lib/auth/username';
import { QUESTIONS } from '@/config/questions';

describe('image maths', () => {
  it('normalises crops to an in-bounds square', () => {
    expect(normaliseCrop({ x: -10, y: 5, width: 500, height: 480 }, 400, 300)).toEqual({ x: 0, y: 0, width: 300, height: 300 });
    expect(normaliseCrop({ x: 350, y: 0, width: 100, height: 100 }, 400, 300)).toEqual({ x: 300, y: 0, width: 100, height: 100 });
    expect(centreCrop(400, 300)).toEqual({ x: 50, y: 0, width: 300, height: 300 });
    // Portrait selfie: crop sits above centre to keep the face.
    expect(centreCrop(300, 400)).toEqual({ x: 0, y: 100 * PORTRAIT_TOP_BIAS, width: 300, height: 300 });
  });

  it('steps down 800 → 128 in halves', () => {
    expect(stepDownSizes(800, 128)).toEqual([400, 200, 128]);
    expect(stepDownSizes(800, 16)).toEqual([400, 200, 100, 50, 25, 16]);
  });
});

describe('name validation', () => {
  it('trims and limits length', () => {
    expect(validateName('  Kasun   Perera ')).toEqual({ ok: true, name: 'Kasun Perera' });
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('x'.repeat(31)).ok).toBe(false);
    expect(validateName('කසුන්')).toEqual({ ok: true, name: 'කසුන්' });
  });

  it('validates name + department together', () => {
    expect(validateRegistration({ name: ' Kasun ', department: '  Human   Resources ' })).toEqual({
      ok: true,
      data: { name: 'Kasun', department: 'Human Resources' },
    });
    const r = validateRegistration({ name: '', department: 'x'.repeat(41) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.department).toBeTruthy();
    }
    expect(validateRegistration({ name: 'Kasun', department: '' }).ok).toBe(false);
  });

  it('blocks profanity incl. leetspeak, allows real names', () => {
    expect(containsProfanity('f u c k')).toBe(true);
    expect(containsProfanity('sh1t')).toBe(true);
    expect(containsProfanity('Dick')).toBe(true);
    expect(containsProfanity('Cassandra')).toBe(false);
    expect(containsProfanity('Dickson Fernando')).toBe(false);
    expect(containsProfanity('Shithara')).toBe(false);
    expect(containsProfanity('Nazir Draper')).toBe(false);
    expect(containsProfanity('bullsh1t')).toBe(true);
  });
});

describe('answers validation', () => {
  const all = Object.fromEntries(QUESTIONS.map((q) => [q.id, [q.options[0].id]]));
  it('accepts a complete valid set', () => {
    expect(validateAnswers(all, QUESTIONS)).toBeNull();
  });
  it('rejects missing, too many, unknown and duplicate', () => {
    expect(validateAnswers({ ...all, q1: [] }, QUESTIONS)).not.toBeNull();
    const q3 = QUESTIONS.find((q) => q.id === 'q3')!;
    const tooMany = q3.options.slice(0, q3.maxSelect + 1).map((o) => o.id);
    expect(validateAnswers({ ...all, q3: tooMany }, QUESTIONS)).not.toBeNull();
    expect(validateAnswers({ ...all, q1: ['zz'] }, QUESTIONS)).not.toBeNull();
    expect(validateAnswers({ ...all, q1: ['a', 'a'] }, QUESTIONS)).not.toBeNull();
    expect(validateAnswers({ ...all, q9: ['a'] }, QUESTIONS)).not.toBeNull();
  });
});

describe('operator usernames', () => {
  it('maps username ↔ email', () => {
    expect(usernameToEmail(' Admin ')).toBe('admin@operators.local');
    expect(emailToUsername('admin@operators.local')).toBe('admin');
    expect(isOperatorEmail('admin@operators.local')).toBe(true);
    expect(isOperatorEmail('someone@operators.local')).toBe(false);
    expect(isOperatorEmail('admin@gmail.com')).toBe(false);
  });
});
