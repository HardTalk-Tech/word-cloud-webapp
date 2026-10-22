'use client';

import { useEffect, useRef } from 'react';
import { BACKGROUND, type BackgroundVariant } from '@/config/background';
import type { ScreenTheme } from '@/config/themes';
import { BackgroundRenderer } from './BackgroundRenderer';

/** Animated LED background canvas; place it first inside <Stage>, under the screen canvas. */
export function StageBackground({
  width,
  height,
  variant,
  theme,
}: {
  width: number;
  height: number;
  variant: BackgroundVariant;
  theme: ScreenTheme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !BACKGROUND.enabled) return;
    const bg = new BackgroundRenderer(ref.current, width, height, variant, theme);
    bg.start();
    return () => bg.destroy();
  }, [width, height, variant, theme]);

  return <canvas ref={ref} className="absolute inset-0" aria-hidden />;
}
