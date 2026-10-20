'use client';

import { useEffect, useRef } from 'react';
import { BACKGROUND, type BackgroundVariant } from '@/config/background';
import { BackgroundRenderer } from './BackgroundRenderer';

/** Animated LED background canvas; place it first inside <Stage>, under the screen canvas. */
export function StageBackground({ width, height, variant }: { width: number; height: number; variant: BackgroundVariant }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !BACKGROUND.enabled) return;
    const bg = new BackgroundRenderer(ref.current, width, height, variant);
    bg.start();
    return () => bg.destroy();
  }, [width, height, variant]);

  return <canvas ref={ref} className="absolute inset-0" aria-hidden />;
}
