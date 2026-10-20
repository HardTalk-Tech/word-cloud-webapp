import { formatTime, type EventData } from './data';

export function StatsBar({ data }: { data: EventData }) {
  const registered = data.rows.length;
  const answered = data.rows.filter((r) => r.answers).length;
  const hidden = data.rows.filter((r) => r.attendee.hidden).length;
  const last = data.rows.reduce<number | null>((m, r) => (r.createdAtMs && (!m || r.createdAtMs > m) ? r.createdAtMs : m), null);
  const rate = registered ? Math.round((answered / registered) * 100) : 0;

  const stats = [
    { label: 'Registered', value: registered.toLocaleString() },
    { label: 'Answered', value: answered.toLocaleString() },
    { label: 'Answer rate', value: `${rate}%` },
    { label: 'Hidden', value: hidden.toLocaleString() },
    { label: 'Last arrival', value: formatTime(last) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
          <div className="text-xs font-semibold tracking-wide text-brand-grey uppercase">{s.label}</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{data.loaded ? s.value : '…'}</div>
        </div>
      ))}
    </div>
  );
}
