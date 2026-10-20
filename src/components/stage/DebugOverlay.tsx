'use client';

import { useEffect, useState } from 'react';
import { useClientValue } from '@/lib/use-client-value';

export type DebugStats = Record<string, string | number>;

/** `?debug=1` on a screen URL. */
export function useDebugFlag(): boolean {
  return useClientValue(() => new URLSearchParams(window.location.search).get('debug') === '1', false);
}

export function DebugOverlay({ getStats }: { getStats: () => DebugStats | null }) {
  const [stats, setStats] = useState<DebugStats | null>(null);
  useEffect(() => {
    const t = setInterval(() => setStats(getStats()), 500);
    return () => clearInterval(t);
  }, [getStats]);
  if (!stats) return null;
  return (
    <div className="absolute left-3 bottom-3 z-50 rounded-lg bg-black/80 px-4 py-3 font-mono text-[18px] leading-7 text-lime-300">
      {Object.entries(stats).map(([k, v]) => (
        <div key={k}>
          {k}: <span className="text-white">{v}</span>
        </div>
      ))}
    </div>
  );
}
