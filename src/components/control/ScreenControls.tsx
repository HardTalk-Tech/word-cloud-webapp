'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QUESTIONS } from '@/config/questions';
import { updateControl, type ControlPatch } from '@/lib/services/control';
import { downloadBlob, downloadText } from '@/lib/export/download';
import { useClientValue } from '@/lib/use-client-value';
import type { ControlState } from '@/types/models';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-xl bg-surface-raised px-4 py-3 text-left ring-1 ring-line"
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-brand' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate rounded-lg bg-surface-raised px-3 py-2 text-sm ring-1 ring-line hover:ring-brand">
        <span className="text-brand-grey">{label}: </span>
        <span className="text-white">{url}</span>
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="h-9 shrink-0 rounded-lg px-3 text-xs font-bold text-brand-grey-light ring-1 ring-line hover:bg-surface-raised"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function ScreenControls({ eventId, control }: { eventId: string; control: ControlState }) {
  const origin = useClientValue(() => window.location.origin, '');
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const joinUrl = `${origin}/e/${eventId}`;

  useEffect(() => {
    if (!origin) return;
    void QRCode.toDataURL(joinUrl, { width: 240, margin: 1, color: { dark: '#0B0B0D', light: '#FFFFFF' } }).then(setQr);
  }, [origin, joinUrl]);

  const set = (patch: ControlPatch) => {
    setError(null);
    updateControl(eventId, patch).catch((e: Error) => setError(e.message));
  };

  const downloadQr = async (kind: 'png' | 'svg') => {
    if (kind === 'svg') {
      const svg = await QRCode.toString(joinUrl, { type: 'svg', margin: 2, errorCorrectionLevel: 'H' });
      downloadText(svg, `qr-${eventId}.svg`, 'image/svg+xml');
    } else {
      const url = await QRCode.toDataURL(joinUrl, { width: 2048, margin: 2, errorCorrectionLevel: 'H' });
      downloadBlob(await (await fetch(url)).blob(), `qr-${eventId}.png`);
    }
  };

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-base font-bold">Screen controls</h2>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-raised p-1 ring-1 ring-line">
        {(['live', 'final'] as const).map((m) => (
          <button
            key={m}
            onClick={() => set({ mode: m })}
            className={`h-11 rounded-lg text-sm font-bold capitalize transition ${control.mode === m ? 'bg-brand text-white' : 'text-brand-grey-light hover:text-white'}`}
          >
            {m === 'live' ? 'Live' : 'Final crown'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <Toggle label="Pause welcome spotlight" on={control.welcomePaused} onChange={(v) => set({ welcomePaused: v })} />
        <Toggle
          label="Auto-rotate cloud questions (30s)"
          on={control.autoRotateQuestions}
          onChange={(v) => set({ autoRotateQuestions: v })}
        />
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold tracking-wide text-brand-grey uppercase">Cloud spotlight question</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[null, ...QUESTIONS.map((q) => q.id)].map((id) => (
            <button
              key={id ?? 'all'}
              disabled={control.autoRotateQuestions}
              title={id ? QUESTIONS.find((q) => q.id === id)?.text : 'All questions'}
              onClick={() => set({ spotlightQuestion: id })}
              className={`h-9 rounded-lg px-3 text-sm font-bold uppercase ring-1 transition disabled:opacity-40 ${
                control.spotlightQuestion === id ? 'bg-white text-ink ring-white' : 'text-brand-grey-light ring-line hover:text-white'
              }`}
            >
              {id ?? 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <CopyLink label="Screen 1" url={`${origin}/screen/${eventId}/welcome`} />
        <CopyLink label="Screen 2" url={`${origin}/screen/${eventId}/cloud`} />
        <CopyLink label="QR target" url={joinUrl} />
      </div>

      <div className="mt-4 flex items-center gap-4">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ${joinUrl}`} className="h-28 w-28 rounded-lg bg-white p-1" />
        )}
        <div className="flex flex-col gap-2">
          <button onClick={() => void downloadQr('png')} className="h-9 rounded-lg px-3 text-sm font-bold ring-1 ring-line hover:bg-surface-raised">
            Download QR (PNG)
          </button>
          <button onClick={() => void downloadQr('svg')} className="h-9 rounded-lg px-3 text-sm font-bold ring-1 ring-line hover:bg-surface-raised">
            Download QR (SVG, print)
          </button>
        </div>
      </div>
    </section>
  );
}
