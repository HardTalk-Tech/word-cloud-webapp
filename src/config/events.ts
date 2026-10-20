// main = the real event; dev = testing and rehearsals (reset it from the dashboard when done).
export const EVENT_IDS = ['main', 'dev'] as const;

export type EventId = (typeof EVENT_IDS)[number];

export const DEFAULT_EVENT: EventId = 'main';

export function isEventId(value: string): value is EventId {
  return (EVENT_IDS as readonly string[]).includes(value);
}

/** File-name prefix for exports. */
export const EXPORT_PREFIX = 'george-steuart';
