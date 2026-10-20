// Export rows (pure, unit tested). Built from data the dashboard already has loaded.
import type { Question } from '@/config/questions';
import { EXPORT_PREFIX } from '@/config/events';
import { aggregate } from '@/lib/cloud/aggregate';

export type ExportAttendee = {
  id: string;
  name: string;
  department: string;
  createdAtMs: number | null;
  hidden: boolean;
  spotUrl: string;
};

export type Answers = Record<string, string[]>;
export type Cell = string | number;

export const TIME_ZONE = 'Asia/Colombo';

function colomboParts(ms: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00';
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** 2026-10-20 18:05:09 in Asia/Colombo. */
export function formatColombo(ms: number | null): string {
  if (ms === null) return '';
  const p = colomboParts(ms);
  return `${p.y}-${p.mo}-${p.d} ${p.h}:${p.mi}:${p.s}`;
}

export function exportFileName(eventId: string, ext: 'xlsx' | 'csv' | 'zip', nowMs: number): string {
  const p = colomboParts(nowMs);
  return `${EXPORT_PREFIX}-${eventId}-${p.y}-${p.mo}-${p.d}-${p.h}${p.mi}.${ext}`;
}

export function labelsFor(question: Question, optionIds: string[] | undefined): string[] {
  if (!optionIds) return [];
  return optionIds.map((id) => question.options.find((o) => o.id === id)?.label ?? id);
}

function sortByTime(attendees: ExportAttendee[]): ExportAttendee[] {
  return attendees.slice().sort((a, b) => (a.createdAtMs ?? Infinity) - (b.createdAtMs ?? Infinity));
}

export function attendeeHeader(questions: Question[]): string[] {
  return ['No.', 'Name', 'Department', 'Registered at', 'Answered', ...questions.map((q) => q.text), 'Photo URL', 'Hidden'];
}

export function buildAttendeeRows(
  attendees: ExportAttendee[],
  responses: Map<string, Answers>,
  questions: Question[],
): Cell[][] {
  return sortByTime(attendees).map((a, i) => {
    const answers = responses.get(a.id);
    return [
      i + 1,
      a.name,
      a.department,
      formatColombo(a.createdAtMs),
      answers ? 'Yes' : 'No',
      ...questions.map((q) => labelsFor(q, answers?.[q.id]).join('; ')),
      a.spotUrl,
      a.hidden ? 'Yes' : 'No',
    ];
  });
}

export const SUMMARY_HEADER = ['Question', 'Option', 'Count', '% of respondents'];

export function buildSummaryRows(responses: Map<string, Answers>, questions: Question[]): Cell[][] {
  const agg = aggregate([...responses.values()].map((answers) => ({ answers })), questions);
  const rows: Cell[][] = [];
  for (const q of questions) {
    const qc = agg.byQuestion.get(q.id)!;
    for (const o of q.options) {
      const count = qc.counts.get(o.id) ?? 0;
      const pct = qc.respondents ? Math.round((count / qc.respondents) * 1000) / 10 : 0;
      rows.push([q.text, o.label, count, pct]);
    }
  }
  return rows;
}

export const LONG_HEADER = ['Name', 'Department', 'Question', 'Option'];

export function buildLongRows(
  attendees: ExportAttendee[],
  responses: Map<string, Answers>,
  questions: Question[],
): Cell[][] {
  const rows: Cell[][] = [];
  for (const a of sortByTime(attendees)) {
    const answers = responses.get(a.id);
    if (!answers) continue;
    for (const q of questions) {
      for (const label of labelsFor(q, answers[q.id])) rows.push([a.name, a.department, q.text, label]);
    }
  }
  return rows;
}

export function csvEscape(v: Cell): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 with BOM so Excel shows Sinhala / Tamil correctly. */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** ZIP file name: 001_Name.jpg, unsafe characters stripped. */
export function photoFileName(index: number, name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, '_').slice(0, 40) || 'attendee';
  return `${String(index).padStart(3, '0')}_${safe}.jpg`;
}
