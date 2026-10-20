'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { BRAND } from '@/config/brand';
import { EVENT_IDS } from '@/config/events';
import { operatorSignOut } from '@/lib/firebase/auth';
import { emailToUsername } from '@/lib/auth/username';
import { useEventData, type Row } from './data';
import { StatsBar } from './StatsBar';
import { ScreenControls } from './ScreenControls';
import { AttendeeTable } from './AttendeeTable';
import { AttendeeDrawer } from './AttendeeDrawer';
import { ResultsPanel } from './ResultsPanel';
import { ExportMenu } from './ExportMenu';
import { ResetDialog } from './ResetDialog';

export function Dashboard({ eventId, user }: { eventId: string; user: User }) {
  const router = useRouter();
  const data = useEventData(eventId);
  const [selected, setSelected] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const selectedRow: Row | undefined = selected ? data.rows.find((r) => r.attendee.id === selected) : undefined;

  return (
    <div className="min-h-dvh bg-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.crown} alt="" className="h-8 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.wordmark} alt={BRAND.name} className="h-5 w-auto" />
          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-brand-grey-light">
            Operator
          </span>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-brand-grey-light">
              Event
              <select
                value={eventId}
                onChange={(e) => router.push(`/control/${e.target.value}`)}
                className="h-9 rounded-lg bg-surface-raised px-3 font-semibold text-white ring-1 ring-line"
              >
                {EVENT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <span className="hidden text-sm text-brand-grey sm:inline">{emailToUsername(user.email ?? '') ?? user.email}</span>
            <button
              onClick={() => void operatorSignOut()}
              className="h-9 rounded-lg px-3 text-sm font-semibold text-brand-grey-light ring-1 ring-line hover:bg-surface-raised"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
        {data.error && (
          <div className="mb-4 rounded-xl bg-red-950/60 px-4 py-3 text-sm text-red-200 ring-1 ring-red-900">
            {data.error}
          </div>
        )}
        <StatsBar data={data} />
        <div className="mt-5 grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <ScreenControls eventId={eventId} control={data.control} />
            <ExportMenu eventId={eventId} data={data} />
            <ResultsPanel responses={data.responses} />
            <section className="rounded-2xl bg-surface p-5 ring-1 ring-red-900/60">
              <h2 className="text-base font-bold text-red-300">Danger zone</h2>
              <p className="mt-1 text-sm text-brand-grey-light">
                Delete every attendee, answer and photo for <b className="text-white">{eventId}</b>. Operator accounts are
                kept.
              </p>
              <button
                onClick={() => setResetOpen(true)}
                className="mt-4 h-10 rounded-lg bg-red-900/70 px-4 text-sm font-bold text-white hover:bg-red-800"
              >
                Reset event…
              </button>
            </section>
          </div>
          <AttendeeTable eventId={eventId} data={data} onSelect={setSelected} />
        </div>
      </main>

      {selectedRow && <AttendeeDrawer eventId={eventId} row={selectedRow} onClose={() => setSelected(null)} />}
      {resetOpen && <ResetDialog eventId={eventId} data={data} onClose={() => setResetOpen(false)} />}
    </div>
  );
}
