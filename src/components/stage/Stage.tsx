'use client';

import { useEffect, type ReactNode } from 'react';
import { BRAND } from '@/config/brand';
import { subscribeResize, useClientValue } from '@/lib/use-client-value';

/** Fixed-resolution stage, scaled to fit the window with a black letterbox. */
export function Stage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const scale = useClientValue(
    () => Math.min(window.innerWidth / width, window.innerHeight / height),
    0,
    subscribeResize,
  );

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 flex cursor-none select-none items-center justify-center overflow-hidden bg-black">
      <div
        style={{
          width,
          height,
          flex: 'none',
          position: 'relative',
          overflow: 'hidden',
          background: BRAND.background,
          transform: `scale(${scale})`,
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
