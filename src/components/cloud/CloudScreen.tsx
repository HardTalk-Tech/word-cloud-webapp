'use client';

import { useCallback, useEffect, useRef } from 'react';
import { STAGE } from '@/config/stage';
import type { ScreenTheme } from '@/config/themes';
import { listenControl, listenResponses } from '@/lib/services/listen';
import { Stage } from '@/components/stage/Stage';
import { StageBackground } from '@/components/stage/StageBackground';
import { DebugOverlay, useDebugFlag } from '@/components/stage/DebugOverlay';
import { useScreenTheme } from '@/components/stage/useScreenTheme';
import { CloudRenderer } from './CloudRenderer';

/** Screen 2. Rebuilt in the new colours whenever the operator switches the screen theme. */
export function CloudScreen({ eventId }: { eventId: string }) {
  const theme = useScreenTheme(eventId);
  if (!theme) return <Stage width={STAGE.width} height={STAGE.height}>{null}</Stage>;
  return <CloudScreenThemed key={theme.id} eventId={eventId} theme={theme} />;
}

function CloudScreenThemed({ eventId, theme }: { eventId: string; theme: ScreenTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CloudRenderer | null>(null);
  const debug = useDebugFlag();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new CloudRenderer(canvas, eventId, theme);
    engineRef.current = engine;
    void engine.init();
    engine.start();
    const onError = (e: Error) => console.error('Screen listener error', e);
    const unsubs = [
      listenControl(eventId, (c) => engine.onControl(c), onError),
      listenResponses(eventId, (r) => engine.onResponses(r), onError),
    ];
    return () => {
      unsubs.forEach((u) => u());
      engine.destroy();
      engineRef.current = null;
    };
  }, [eventId, theme]);

  const getStats = useCallback(() => engineRef.current?.stats() ?? null, []);

  return (
    <Stage width={STAGE.width} height={STAGE.height}>
      <StageBackground width={STAGE.width} height={STAGE.height} variant="cloud" theme={theme} />
      <canvas ref={canvasRef} className="absolute inset-0" />
      {debug && <DebugOverlay getStats={getStats} />}
    </Stage>
  );
}
