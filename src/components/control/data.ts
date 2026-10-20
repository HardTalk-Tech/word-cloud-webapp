'use client';

import { useEffect, useMemo, useState } from 'react';
import { listenAttendees, listenControl, listenResponses } from '@/lib/services/listen';
import { ensureControlDoc } from '@/lib/services/control';
import type { Answers, ExportAttendee } from '@/lib/export/build';
import { DEFAULT_CONTROL, type Attendee, type ControlState, type ResponseDoc } from '@/types/models';

export type Row = {
  no: number;
  attendee: Attendee;
  createdAtMs: number | null;
  answers: Answers | undefined;
};

export type EventData = {
  loaded: boolean;
  attendees: Attendee[];
  responses: ResponseDoc[];
  responseMap: Map<string, Answers>;
  rows: Row[];
  control: ControlState;
  error: string | null;
};

/** Live attendees + responses + control for the dashboard, joined by id. */
export function useEventData(eventId: string): EventData {
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [responses, setResponses] = useState<ResponseDoc[] | null>(null);
  const [control, setControl] = useState<ControlState>(DEFAULT_CONTROL);
  const [error, setError] = useState<string | null>(null);

  // Callers remount per event (key={eventId}), so state starts empty for each event.
  useEffect(() => {
    const onError = (e: Error) => setError(e.message);
    const unsubs = [
      listenAttendees(eventId, (s) => setAttendees(s.attendees), onError),
      listenResponses(eventId, setResponses, onError),
      listenControl(eventId, setControl, onError),
    ];
    ensureControlDoc(eventId).catch((e: Error) => setError(e.message));
    return () => unsubs.forEach((u) => u());
  }, [eventId]);

  const responseMap = useMemo(
    () => new Map((responses ?? []).map((r) => [r.id, r.answers] as const)),
    [responses],
  );

  const rows = useMemo<Row[]>(
    () =>
      (attendees ?? []).map((a, i) => ({
        no: i + 1,
        attendee: a,
        createdAtMs: a.createdAt ? a.createdAt.toMillis() : null,
        answers: responseMap.get(a.id),
      })),
    [attendees, responseMap],
  );

  return {
    loaded: attendees !== null && responses !== null,
    attendees: attendees ?? [],
    responses: responses ?? [],
    responseMap,
    rows,
    control,
    error,
  };
}

export function toExportAttendees(rows: Row[]): ExportAttendee[] {
  return rows.map((r) => ({
    id: r.attendee.id,
    name: r.attendee.name,
    department: r.attendee.department,
    createdAtMs: r.createdAtMs,
    hidden: r.attendee.hidden,
    spotUrl: r.attendee.spotUrl,
  }));
}

export function formatTime(ms: number | null): string {
  if (ms === null) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms));
}
