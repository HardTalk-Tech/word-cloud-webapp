import { useMemo } from 'react';
import { QUESTIONS } from '@/config/questions';
import { aggregate } from '@/lib/cloud/aggregate';
import type { ResponseDoc } from '@/types/models';

export function ResultsPanel({ responses }: { responses: ResponseDoc[] }) {
  const agg = useMemo(() => aggregate(responses, QUESTIONS), [responses]);

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-base font-bold">Results</h2>
      <p className="mt-1 text-xs text-brand-grey">
        % of respondents per question. Multiple choices allowed, so totals can exceed 100%.
      </p>
      {/* Full width under the table: questions side by side instead of one long column. */}
      <div className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2 2xl:grid-cols-3">
        {QUESTIONS.map((q) => {
          const qc = agg.byQuestion.get(q.id)!;
          const max = Math.max(1, ...qc.counts.values());
          const options = q.options
            .map((o) => ({ ...o, count: qc.counts.get(o.id) ?? 0 }))
            .sort((a, b) => b.count - a.count);
          return (
            <div key={q.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold">
                  <span className="text-brand">{q.id.toUpperCase()}</span> {q.text}
                </h3>
                <span className="shrink-0 text-xs text-brand-grey">{qc.respondents} answered</span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {options.map((o) => {
                  const pct = qc.respondents ? Math.round((o.count / qc.respondents) * 100) : 0;
                  return (
                    <div key={o.id} className="grid grid-cols-[120px_1fr_72px] items-center gap-2 text-sm">
                      <span className="truncate text-brand-grey-light">{o.label}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-surface-raised">
                        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(o.count / max) * 100}%` }} />
                      </div>
                      <span className="text-right tabular-nums">
                        {o.count} <span className="text-brand-grey">· {pct}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
