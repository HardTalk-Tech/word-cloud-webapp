'use client';

import { useCallback, useEffect, useRef } from 'react';
import { STAGE } from '@/config/stage';
import { listenControl, listenResponses } from '@/lib/services/listen';
import { Stage } from '@/components/stage/Stage';
import { StageBackground } from '@/components/stage/StageBackground';
import { DebugOverlay, useDebugFlag } from '@/components/stage/DebugOverlay';
import { CloudRenderer } from './CloudRenderer';

export function CloudScreen({ eventId }: { eventId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CloudRenderer | null>(null);
  const debug = useDebugFlag();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new CloudRenderer(canvas, eventId);
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
  }, [eventId]);

  const getStats = useCallback(() => engineRef.current?.stats() ?? null, []);

  return (
    <Stage width={STAGE.width} height={STAGE.height}>
      <StageBackground width={STAGE.width} height={STAGE.height} variant="cloud" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      {debug && <DebugOverlay getStats={getStats} />}
    </Stage>
  );
}
