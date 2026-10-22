import { describe, expect, it } from 'vitest';
import { DEPARTMENTS } from '@/config/departments';
import { canonicalDepartment, highlightParts, searchDepartments } from '@/lib/departments';

const search = (q: string) => searchDepartments(q, DEPARTMENTS, 8).results;

describe('searchDepartments', () => {
  it('shows nothing until the user types (never the full list)', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
  });

  it('caps the suggestions and reports how many matched in total', () => {
    const r = searchDepartments('a', DEPARTMENTS, 8);
    expect(r.results).toHaveLength(8);
    expect(r.total).toBeGreaterThan(8);
  });

  it('puts names that start with the query first', () => {
    expect(search('arr')[0]).toMatch(/^Arrowil/);
    expect(search('human')[0]).toBe('Human Resources');
  });

  it('matches word starts in any order, ignoring case, dashes and dots', () => {
    expect(search('braun wound')[0]).toBe('B-Braun Wound Care');
    expect(search('wound braun')[0]).toBe('B-Braun Wound Care');
    expect(search('gsh acc')[0]).toBe('Gsh - Accounts');
    expect(search('sales admin')[0]).toBe('Sales Admin. Division');
    expect(search('IT systems')[0]).toBe('It & Systems Support');
  });

  it('matches letters typed together', () => {
    expect(search('bbraun')).toContain('B-Braun Stents');
    expect(search('gshwarehouse')[0]).toBe('Gsh - Warehouse');
  });

  it('returns nothing for a department that is not listed', () => {
    expect(search('Finance Team')).toEqual([]);
  });
});

describe('canonicalDepartment', () => {
  it('uses the list spelling for a listed department, else the text as typed', () => {
    expect(canonicalDepartment('  human   resources ', DEPARTMENTS)).toBe('Human Resources');
    expect(canonicalDepartment('gsh accounts', DEPARTMENTS)).toBe('Gsh - Accounts');
    expect(canonicalDepartment('  Finance   Team ', DEPARTMENTS)).toBe('Finance Team');
  });
});

describe('highlightParts', () => {
  it('marks the matched letters', () => {
    expect(highlightParts('B-Braun Wound Care', 'wou')).toEqual([
      { text: 'B-Braun ', match: false },
      { text: 'Wou', match: true },
      { text: 'nd Care', match: false },
    ]);
    expect(highlightParts('Gsh - Accounts', '')).toEqual([{ text: 'Gsh - Accounts', match: false }]);
  });
});
