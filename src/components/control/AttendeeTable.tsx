'use client';

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { QUESTIONS } from '@/config/questions';
import { labelsFor } from '@/lib/export/build';
import { setAttendeeHidden } from '@/lib/services/control';
import { formatTime, type EventData, type Row } from './data';

type Filter = 'all' | 'answered' | 'unanswered' | 'hidden';
type Sort = 'time-desc' | 'time-asc' | 'name';

const COLS = `52px 52px minmax(170px,1.3fr) minmax(130px,1fr) 92px 84px repeat(${QUESTIONS.length}, minmax(150px,1fr)) 92px 104px`;
const ROW_H = 60;

export function AttendeeTable({
  eventId,
  data,
  onSelect,
}: {
  eventId: string;
  data: EventData;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('time-desc');
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data.rows.filter((r) => {
      if (
        term &&
        !r.attendee.name.toLowerCase().includes(term) &&
        !r.attendee.department.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (filter === 'answered') return !!r.answers;
      if (filter === 'unanswered') return !r.answers;
      if (filter === 'hidden') return r.attendee.hidden;
      return true;
    });
    if (sort === 'name') list.sort((a, b) => a.attendee.name.localeCompare(b.attendee.name));
    else if (sort === 'time-desc') list.reverse();
    return list;
  }, [data.rows, search, filter, sort]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const counts = {
    all: data.rows.length,
    answered: data.rows.filter((r) => r.answers).length,
    unanswered: data.rows.filter((r) => !r.answers).length,
    hidden: data.rows.filter((r) => r.attendee.hidden).length,
  };

  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <h2 className="mr-2 text-base font-bold">Attendees &amp; answers</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or department…"
          className="h-9 w-56 rounded-lg bg-surface-raised px-3 text-sm ring-1 ring-line outline-none focus:ring-brand"
        />
        <div className="flex gap-1 rounded-lg bg-surface-raised p-1 ring-1 ring-line">
          {(['all', 'answered', 'unanswered', 'hidden'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-7 rounded-md px-2.5 text-xs font-bold capitalize ${filter === f ? 'bg-white text-ink' : 'text-brand-grey-light hover:text-white'}`}
            >
              {f === 'unanswered' ? 'Not answered' : f} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto h-9 rounded-lg bg-surface-raised px-3 text-sm ring-1 ring-line"
        >
          <option value="time-desc">Newest first</option>
          <option value="time-asc">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div ref={scrollRef} className="dash-scroll h-[max(520px,calc(100dvh-260px))] overflow-auto">
        <div className="min-w-360">
          <div
            className="sticky top-0 z-10 grid items-center gap-3 border-b border-line bg-surface px-4 py-2 text-xs font-semibold tracking-wide text-brand-grey uppercase"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>#</span>
            <span>Photo</span>
            <span>Name</span>
            <span>Department</span>
            <span>Registered</span>
            <span>Answered</span>
            {QUESTIONS.map((q) => (
              <span key={q.id} className="truncate" title={q.text}>
                {q.id.toUpperCase()} · {q.text}
              </span>
            ))}
            <span>Status</span>
            <span>Action</span>
          </div>
          {!data.loaded ? (
            <div className="p-8 text-center text-brand-grey">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-brand-grey">No attendees{search || filter !== 'all' ? ' match' : ' yet'}.</div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((v) => {
                const row = rows[v.index];
                return (
                  <TableRow
                    key={row.attendee.id}
                    row={row}
                    top={v.start}
                    eventId={eventId}
                    onSelect={() => onSelect(row.attendee.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TableRow({ row, top, eventId, onSelect }: { row: Row; top: number; eventId: string; onSelect: () => void }) {
  const a = row.attendee;
  const [busy, setBusy] = useState(false);
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await setAttendeeHidden(eventId, a.id, !a.hidden);
    } catch (err) {
      alert(`Could not update: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`absolute inset-x-0 grid cursor-pointer items-center gap-3 border-b border-line/60 px-4 text-sm hover:bg-surface-raised ${a.hidden ? 'opacity-55' : ''}`}
      style={{ gridTemplateColumns: COLS, height: ROW_H, transform: `translateY(${top}px)` }}
    >
      <span className="text-brand-grey tabular-nums">{row.no}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.tileUrl || a.lqip} alt="" loading="lazy" className="h-10 w-10 rounded-md bg-surface-raised object-cover" />
      <span className="truncate font-semibold">{a.name}</span>
      <span className="truncate text-brand-grey-light">{a.department || '—'}</span>
      <span className="text-brand-grey-light tabular-nums">{formatTime(row.createdAtMs)}</span>
      <span className={row.answers ? 'text-emerald-400' : 'text-brand-grey'}>{row.answers ? 'Yes' : 'No'}</span>
      {QUESTIONS.map((q) => (
        <span key={q.id} className="truncate text-brand-grey-light" title={labelsFor(q, row.answers?.[q.id]).join(', ')}>
          {labelsFor(q, row.answers?.[q.id]).join(', ') || '—'}
        </span>
      ))}
      <span className={a.hidden ? 'font-semibold text-amber-400' : 'text-brand-grey-light'}>{a.hidden ? 'Hidden' : 'Visible'}</span>
      <button
        onClick={toggle}
        disabled={busy}
        className={`h-8 rounded-lg px-3 text-xs font-bold ring-1 disabled:opacity-50 ${
          a.hidden ? 'text-white ring-line hover:bg-surface' : 'text-red-300 ring-red-900 hover:bg-red-950'
        }`}
      >
        {a.hidden ? 'Restore' : 'Hide'}
      </button>
    </div>
  );
}
