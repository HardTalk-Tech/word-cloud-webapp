'use client';

import { useEffect, useState } from 'react';
import { QUESTIONS } from '@/config/questions';
import { formatColombo, labelsFor } from '@/lib/export/build';
import { setAttendeeHidden } from '@/lib/services/control';
import type { Row } from './data';

export function AttendeeDrawer({ eventId, row, onClose }: { eventId: string; row: Row; onClose: () => void }) {
  const a = row.attendee;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await setAttendeeHidden(eventId, a.id, !a.hidden);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="dash-scroll h-full w-full max-w-md overflow-y-auto bg-surface p-6 ring-1 ring-line"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-brand-grey">#{row.no}</div>
            <h2 className="text-2xl font-extrabold break-words">{a.name}</h2>
            {a.department && <div className="mt-0.5 text-brand-grey-light">{a.department}</div>}
          </div>
          <button onClick={onClose} className="h-9 rounded-lg px-3 text-sm font-bold ring-1 ring-line hover:bg-surface-raised">
            Close
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.spotUrl || a.tileUrl || a.lqip}
          alt={a.name}
          className={`mt-5 aspect-square w-full rounded-2xl bg-surface-raised object-cover ${a.hidden ? 'opacity-50 grayscale' : ''}`}
        />
        <div className="mt-4 flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${a.hidden ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
            {a.hidden ? 'Hidden from screens' : 'Visible on screens'}
          </span>
          <button
            onClick={toggle}
            disabled={busy}
            className={`ml-auto h-10 rounded-lg px-4 text-sm font-bold disabled:opacity-50 ${a.hidden ? 'bg-white text-ink' : 'bg-red-900/70 text-white hover:bg-red-800'}`}
          >
            {a.hidden ? 'Restore' : 'Hide'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <dl className="mt-5 grid grid-cols-[110px_1fr] gap-y-1 text-sm">
          <dt className="text-brand-grey">Registered</dt>
          <dd>{formatColombo(row.createdAtMs) || '—'}</dd>
          <dt className="text-brand-grey">Answered</dt>
          <dd>{row.answers ? 'Yes' : 'No'}</dd>
          <dt className="text-brand-grey">Device id</dt>
          <dd className="truncate font-mono text-xs leading-5 text-brand-grey-light">{a.id}</dd>
        </dl>
        <div className="mt-6 flex flex-col gap-4">
          {QUESTIONS.map((q) => {
            const labels = labelsFor(q, row.answers?.[q.id]);
            return (
              <div key={q.id}>
                <div className="text-sm font-bold">
                  <span className="text-brand">{q.id.toUpperCase()}</span> {q.text}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {labels.length ? (
                    labels.map((l) => (
                      <span key={l} className="rounded-full bg-surface-raised px-3 py-1 text-sm ring-1 ring-line">
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-brand-grey">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
