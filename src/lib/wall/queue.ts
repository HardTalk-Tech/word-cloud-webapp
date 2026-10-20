// Welcome spotlight queue (pure state machine).
// WALL_IDLE → SPOT_IN → SPOT_HOLD → SPOT_FLY → (next | WALL_IDLE)
import { SPOTLIGHT } from '@/config/timings';

export type Phase = 'WALL_IDLE' | 'SPOT_IN' | 'SPOT_HOLD' | 'SPOT_FLY';

export type QueueConfig = {
  inMs: number;
  flyMs: number;
  holdShortMs: number;
  holdMediumMs: number;
  holdGroupMs: number;
  shortQueueMax: number;
  mediumQueueMax: number;
  groupMax: number;
  imageWaitMs: number;
};

export type QueueState = {
  phase: Phase;
  queue: string[];
  current: string[];
  phaseStartedAt: number;
  holdMs: number;
  /** When we started waiting for the next spotlight's photos to decode. */
  waitingSince: number | null;
};

export type QueueEvent =
  | { type: 'start'; ids: string[] }
  | { type: 'fly'; ids: string[] }
  | { type: 'landed'; ids: string[] };

export type TickInput = {
  now: number;
  paused: boolean;
  isReady: (id: string) => boolean;
};

export function initialQueue(): QueueState {
  return { phase: 'WALL_IDLE', queue: [], current: [], phaseStartedAt: 0, holdMs: 0, waitingSince: null };
}

export function enqueue(s: QueueState, ids: string[]): QueueState {
  const known = new Set([...s.queue, ...s.current]);
  const add = ids.filter((id) => {
    if (known.has(id)) return false;
    known.add(id);
    return true;
  });
  return add.length ? { ...s, queue: [...s.queue, ...add] } : s;
}

/** Drop an attendee (e.g. hidden by the operator). Aborts the spotlight if nobody is left on it. */
export function removeId(s: QueueState, id: string): QueueState {
  const inQueue = s.queue.includes(id);
  const inCurrent = s.current.includes(id);
  if (!inQueue && !inCurrent) return s;
  const queue = inQueue ? s.queue.filter((x) => x !== id) : s.queue;
  const current = inCurrent ? s.current.filter((x) => x !== id) : s.current;
  if (inCurrent && current.length === 0) {
    return { ...s, queue, current, phase: 'WALL_IDLE', waitingSince: null };
  }
  return { ...s, queue, current };
}

/** Group size and hold time for the next spotlight, given the queue length. */
export function planNext(queueLength: number, cfg: QueueConfig = SPOTLIGHT): { size: number; holdMs: number } {
  if (queueLength > cfg.mediumQueueMax) return { size: Math.min(cfg.groupMax, queueLength), holdMs: cfg.holdGroupMs };
  if (queueLength > cfg.shortQueueMax) return { size: 1, holdMs: cfg.holdMediumMs };
  return { size: 1, holdMs: cfg.holdShortMs };
}

export function tick(
  s: QueueState,
  { now, paused, isReady }: TickInput,
  cfg: QueueConfig = SPOTLIGHT,
): { state: QueueState; events: QueueEvent[] } {
  const elapsed = now - s.phaseStartedAt;
  switch (s.phase) {
    case 'WALL_IDLE': {
      if (paused || s.queue.length === 0) {
        return { state: s.waitingSince === null ? s : { ...s, waitingSince: null }, events: [] };
      }
      const { size, holdMs } = planNext(s.queue.length, cfg);
      const next = s.queue.slice(0, size);
      const timedOut = s.waitingSince !== null && now - s.waitingSince >= cfg.imageWaitMs;
      if (!next.every(isReady) && !timedOut) {
        return { state: s.waitingSince === null ? { ...s, waitingSince: now } : s, events: [] };
      }
      return {
        state: {
          ...s,
          phase: 'SPOT_IN',
          queue: s.queue.slice(size),
          current: next,
          phaseStartedAt: now,
          holdMs,
          waitingSince: null,
        },
        events: [{ type: 'start', ids: next }],
      };
    }
    case 'SPOT_IN':
      if (elapsed >= cfg.inMs) return { state: { ...s, phase: 'SPOT_HOLD', phaseStartedAt: now }, events: [] };
      return { state: s, events: [] };
    case 'SPOT_HOLD':
      if (elapsed >= s.holdMs) {
        return { state: { ...s, phase: 'SPOT_FLY', phaseStartedAt: now }, events: [{ type: 'fly', ids: s.current }] };
      }
      return { state: s, events: [] };
    case 'SPOT_FLY':
      if (elapsed >= cfg.flyMs) {
        return {
          state: { ...s, phase: 'WALL_IDLE', current: [], phaseStartedAt: now, waitingSince: null },
          events: [{ type: 'landed', ids: s.current }],
        };
      }
      return { state: s, events: [] };
  }
}

/** After a reload: attendees created after the last spotlight, newest `max`, oldest first. */
export function catchUpIds(
  attendees: { id: string; createdAtMs: number; hidden: boolean }[],
  lastSpotlightedAt: number | null,
  max: number,
): string[] {
  if (lastSpotlightedAt === null) return [];
  const pending = attendees
    .filter((a) => !a.hidden && a.createdAtMs > lastSpotlightedAt)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
  return pending.slice(-max).map((a) => a.id);
}
