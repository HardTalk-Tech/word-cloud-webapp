'use client';

import { useState } from 'react';
import { resetEvent, type ResetProgress } from '@/lib/services/reset';
import { exportExcel } from './ExportMenu';
import type { EventData } from './data';

export function ResetDialog({ eventId, data, onClose }: { eventId: string; data: EventData; onClose: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [progress, setProgress] = useState<ResetProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const phrase = `RESET ${eventId}`;
  const running = progress !== null && progress.step !== 'done';
  const done = progress?.step === 'done';

  const start = async () => {
    setError(null);
    try {
      await resetEvent(eventId, setProgress);
    } catch (e) {
      setError(`${(e as Error).message}. It is safe to run the reset again.`);
      setProgress(null);
    }
  };

  const download = async () => {
    setExporting(true);
    try {
      await exportExcel(eventId, data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 ring-1 ring-red-900">
        <h2 className="text-xl font-extrabold text-red-300">Reset “{eventId}”</h2>
        {!done && (
          <>
            <p className="mt-3 text-sm text-brand-grey-light">This permanently deletes:</p>
            <ul className="mt-2 list-inside list-disc text-sm">
              <li>{data.attendees.length} attendees</li>
              <li>{data.responses.length} responses</li>
              <li>~{data.attendees.length * 2} images</li>
            </ul>
            <p className="mt-3 text-sm text-brand-grey-light">
              Both screens clear immediately and phones can register again. Operator accounts and other events are not
              affected.
            </p>
            <button
              onClick={() => void download()}
              disabled={exporting || running}
              className="mt-4 h-10 w-full rounded-lg text-sm font-bold ring-1 ring-line hover:bg-surface-raised disabled:opacity-50"
            >
              {exporting ? 'Building Excel…' : 'Download Excel first'}
            </button>
            <label className="mt-4 block text-sm text-brand-grey-light">
              Type <b className="font-mono text-white">{phrase}</b> to confirm
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={running}
                className="mt-2 h-11 w-full rounded-lg bg-surface-raised px-3 font-mono text-white ring-1 ring-line outline-none focus:ring-red-700"
              />
            </label>
          </>
        )}

        {progress && (
          <div className="mt-4">
            <div className="text-sm font-semibold">{progress.label}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full bg-red-600 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
              />
            </div>
            {running && <p className="mt-2 text-xs text-amber-300">Keep this tab open until it finishes.</p>}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={running}
            className="h-10 rounded-lg px-4 text-sm font-bold ring-1 ring-line hover:bg-surface-raised disabled:opacity-50"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={() => void start()}
              disabled={confirm !== phrase || running}
              className="h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-40"
            >
              {running ? 'Resetting…' : 'Confirm reset'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
