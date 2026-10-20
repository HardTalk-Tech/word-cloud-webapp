'use client';

import { useState } from 'react';
import { QUESTIONS } from '@/config/questions';
import {
  LONG_HEADER,
  SUMMARY_HEADER,
  attendeeHeader,
  buildAttendeeRows,
  buildLongRows,
  buildSummaryRows,
  exportFileName,
  photoFileName,
  toCsv,
} from '@/lib/export/build';
import { downloadBlob, downloadText } from '@/lib/export/download';
import { toExportAttendees, type EventData } from './data';

const ZIP_CONCURRENCY = 8;

/** Excel / CSV / photos built in the browser from the data already loaded. */
export async function exportExcel(eventId: string, data: EventData): Promise<void> {
  const attendees = toExportAttendees(data.rows);
  const { buildWorkbook } = await import('@/lib/export/xlsx');
  const blob = await buildWorkbook([
    { name: 'Attendees', header: attendeeHeader(QUESTIONS), rows: buildAttendeeRows(attendees, data.responseMap, QUESTIONS) },
    { name: 'Summary', header: SUMMARY_HEADER, rows: buildSummaryRows(data.responseMap, QUESTIONS) },
    { name: 'Answers (long)', header: LONG_HEADER, rows: buildLongRows(attendees, data.responseMap, QUESTIONS) },
  ]);
  downloadBlob(blob, exportFileName(eventId, 'xlsx', Date.now()));
}

export function ExportMenu({ eventId, data }: { eventId: string; data: EventData }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const csv = async () => {
    const attendees = toExportAttendees(data.rows);
    const text = toCsv(attendeeHeader(QUESTIONS), buildAttendeeRows(attendees, data.responseMap, QUESTIONS));
    downloadText(text, exportFileName(eventId, 'csv', Date.now()), 'text/csv;charset=utf-8');
  };

  const photos = async () => {
    const { default: JSZip } = await import('jszip');
    const z = new JSZip();
    const list = toExportAttendees(data.rows).sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
    let done = 0;
    let failed = 0;
    setZip({ done, total: list.length });
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(ZIP_CONCURRENCY, list.length) }, async () => {
        while (next < list.length) {
          const i = next++;
          const a = list[i];
          try {
            const res = await fetch(a.spotUrl);
            if (!res.ok) throw new Error(String(res.status));
            z.file(photoFileName(i + 1, a.name), await res.blob());
          } catch {
            failed++;
          }
          done++;
          setZip({ done, total: list.length });
        }
      }),
    );
    const blob = await z.generateAsync({ type: 'blob' });
    downloadBlob(blob, exportFileName(eventId, 'zip', Date.now()));
    setZip(null);
    if (failed) {
      setError(
        `${failed} photo(s) could not be downloaded. If all failed, set CORS on the storage bucket (see docs/RUNBOOK.md).`,
      );
    }
  };

  const btn =
    'h-11 rounded-xl px-4 text-sm font-bold ring-1 ring-line transition hover:bg-surface-raised disabled:opacity-50';

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-base font-bold">Export</h2>
      <p className="mt-1 text-xs text-brand-grey">{data.rows.length} attendees · {data.responses.length} responses</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
        <button
          onClick={() => void run('xlsx', () => exportExcel(eventId, data))}
          disabled={!!busy || !data.loaded}
          className={`${btn} bg-brand text-white ring-brand hover:bg-brand hover:brightness-110`}
        >
          {busy === 'xlsx' ? 'Building Excel…' : 'Excel (.xlsx) — recommended'}
        </button>
        <button onClick={() => void run('csv', csv)} disabled={!!busy || !data.loaded} className={btn}>
          CSV (attendees)
        </button>
        <button onClick={() => void run('zip', photos)} disabled={!!busy || !data.loaded} className={btn}>
          {zip ? `Photos ${zip.done} / ${zip.total}` : 'Photos (.zip)'}
        </button>
      </div>
      {zip && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full bg-brand transition-all" style={{ width: `${zip.total ? (zip.done / zip.total) * 100 : 0}%` }} />
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
