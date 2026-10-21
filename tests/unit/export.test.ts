import { describe, expect, it } from 'vitest';
import {
  attendeeHeader,
  buildAttendeeRows,
  buildLongRows,
  buildSummaryRows,
  csvEscape,
  exportFileName,
  formatColombo,
  photoFileName,
  toCsv,
  type Answers,
  type ExportAttendee,
} from '@/lib/export/build';
import { QUESTIONS } from '@/config/questions';

// 2026-10-20 12:30:00 UTC = 18:00:00 Asia/Colombo (+05:30)
const T = Date.UTC(2026, 9, 20, 12, 30, 0);

const attendees: ExportAttendee[] = [
  { id: 'b', name: 'Nimal, "Jr"', department: 'Sales', createdAtMs: T + 60_000, hidden: true, spotUrl: 'https://x/b.jpg' },
  { id: 'a', name: 'කසුන්', department: 'Finance', createdAtMs: T, hidden: false, spotUrl: 'https://x/a.jpg' },
];
const responses = new Map<string, Answers>([['a', { q1: ['a', 'c'], q2: ['b'] }]]);

describe('export rows', () => {
  it('header has question texts in order', () => {
    const h = attendeeHeader(QUESTIONS);
    expect(h.slice(0, 5)).toEqual(['No.', 'Name', 'Department', 'Registered at', 'Answered']);
    expect(h.slice(5, 10)).toEqual(QUESTIONS.map((q) => q.text));
    expect(h.slice(10)).toEqual(['Photo URL', 'Hidden']);
  });

  it('attendee rows are time-ordered and map option ids to labels', () => {
    const rows = buildAttendeeRows(attendees, responses, QUESTIONS);
    expect(rows[0][0]).toBe(1);
    expect(rows[0][1]).toBe('කසුන්');
    expect(rows[0][2]).toBe('Finance');
    expect(rows[0][3]).toBe('2026-10-20 18:00:00');
    expect(rows[0][4]).toBe('Yes');
    expect(rows[0][5]).toBe('People; Trust');
    expect(rows[0][6]).toBe('Planning');
    expect(rows[1][4]).toBe('No');
    expect(rows[1].at(-1)).toBe('Yes');
  });

  it('summary + long rows', () => {
    const summary = buildSummaryRows(responses, QUESTIONS);
    expect(summary.find((r) => r[1] === 'People')).toEqual([QUESTIONS[0].text, 'People', 1, 100]);
    expect(summary.find((r) => r[1] === 'Teamwork')![2]).toBe(0);
    const long = buildLongRows(attendees, responses, QUESTIONS);
    expect(long).toEqual([
      ['කසුන්', 'Finance', QUESTIONS[0].text, 'People'],
      ['කසුන්', 'Finance', QUESTIONS[0].text, 'Trust'],
      ['කසුන්', 'Finance', QUESTIONS[1].text, 'Planning'],
    ]);
  });
});

describe('csv', () => {
  it('starts with a BOM and escapes commas, quotes, newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('x\ny')).toBe('"x\ny"');
    expect(csvEscape(5)).toBe('5');
    const csv = toCsv(['A', 'B'], [['Nimal, "Jr"', 'කසුන්']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿A,B\r\n"Nimal, ""Jr""",කසුන්\r\n');
  });
});

describe('names', () => {
  it('formats Colombo time and file names', () => {
    expect(formatColombo(null)).toBe('');
    expect(exportFileName('main', 'xlsx', T)).toBe('george-steuart-main-2026-10-20-1800.xlsx');
    expect(photoFileName(7, 'A/B: "C"  D')).toBe('007_AB_C_D.jpg');
  });
});
