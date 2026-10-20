'use client';

import { useCallback, useEffect, useRef } from 'react';
import { STAGE } from '@/config/stage';
import { listenAttendees, listenControl } from '@/lib/services/listen';
import { Stage } from '@/components/stage/Stage';
import { StageBackground } from '@/components/stage/StageBackground';
import { DebugOverlay, useDebugFlag } from '@/components/stage/DebugOverlay';
import { MainEngine } from './MainEngine';

export function MainScreen({ eventId }: { eventId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MainEngine | null>(null);
  const debug = useDebugFlag();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new MainEngine(canvas, confettiRef.current, eventId);
    engineRef.current = engine;
    void engine.init();
    engine.start();
    const onError = (e: Error) => console.error('Screen listener error', e);
    const unsubs = [
      listenControl(eventId, (c) => engine.onControl(c), onError),
      listenAttendees(eventId, (s) => engine.onAttendees(s.attendees, s.fromCache), onError, true),
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
      <StageBackground width={STAGE.width} height={STAGE.height} variant="welcome" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <canvas ref={confettiRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {debug && <DebugOverlay getStats={getStats} />}
    </Stage>
  );
}
