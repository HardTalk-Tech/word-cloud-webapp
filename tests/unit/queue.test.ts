import { describe, expect, it } from 'vitest';
import { catchUpIds, enqueue, initialQueue, planNext, removeId, tick, type QueueState } from '@/lib/wall/queue';
import { SPOTLIGHT } from '@/config/timings';

const ready = () => true;

/** Run the machine until the queue drains; returns spotlight groups in order. */
function drain(s: QueueState, isReady: (id: string) => boolean = ready) {
  const groups: string[][] = [];
  let now = 0;
  for (let i = 0; i < 100000 && (s.queue.length || s.current.length); i++) {
    now += 16;
    const r = tick(s, { now, paused: false, isReady });
    s = r.state;
    for (const e of r.events) if (e.type === 'start') groups.push(e.ids);
  }
  return { groups, state: s, now };
}

describe('queue', () => {
  it('shows attendees in arrival order, nobody skipped', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `a${i}`);
    const { groups } = drain(enqueue(initialQueue(), ids));
    expect(groups.flat()).toEqual(ids);
  });

  it('dedupes enqueues', () => {
    let s = enqueue(initialQueue(), ['a', 'b']);
    s = enqueue(s, ['b', 'c', 'c']);
    expect(s.queue).toEqual(['a', 'b', 'c']);
  });

  it('always one person, same hold for everyone', () => {
    expect(planNext()).toEqual({ size: 1, holdMs: SPOTLIGHT.holdMs });
  });

  it('each spotlight takes 3 s in total (in + hold + fly)', () => {
    expect(SPOTLIGHT.inMs + SPOTLIGHT.holdMs + SPOTLIGHT.flyMs).toBe(3000);
  });

  it('a burst of 30 plays one person at a time, in order, nobody skipped, ~3 s each', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `p${i}`);
    const { groups, now } = drain(enqueue(initialQueue(), ids));
    expect(groups.flat()).toEqual(ids);
    expect(groups.every((g) => g.length === 1)).toBe(true);
    // 30 × 3 s, plus at most a few 16 ms ticks between people.
    expect(now).toBeGreaterThanOrEqual(30 * 3000);
    expect(now).toBeLessThan(30 * 3000 + 30 * 3 * 16 + 100);
  });

  it('a huge backlog still spotlights everyone one by one', () => {
    const ids = Array.from({ length: 120 }, (_, i) => `q${i}`);
    const { groups } = drain(enqueue(initialQueue(), ids));
    expect(groups).toHaveLength(120);
    expect(groups.flat()).toEqual(ids);
  });

  it('goes through IN → HOLD → FLY → IDLE with events', () => {
    let s = enqueue(initialQueue(), ['x']);
    const events: string[] = [];
    let now = 0;
    for (let i = 0; i < 1000; i++) {
      now += 50;
      const r = tick(s, { now, paused: false, isReady: ready });
      s = r.state;
      events.push(...r.events.map((e) => e.type));
    }
    expect(events).toEqual(['start', 'fly', 'landed']);
    expect(s.phase).toBe('WALL_IDLE');
  });

  it('stays idle while paused but keeps the queue', () => {
    let s = enqueue(initialQueue(), ['a', 'b']);
    s = tick(s, { now: 100, paused: true, isReady: ready }).state;
    expect(s.phase).toBe('WALL_IDLE');
    expect(s.queue).toEqual(['a', 'b']);
  });

  it('waits for the photo, then gives up after imageWaitMs', () => {
    let s = enqueue(initialQueue(), ['a']);
    s = tick(s, { now: 0, paused: false, isReady: () => false }).state;
    expect(s.phase).toBe('WALL_IDLE');
    s = tick(s, { now: SPOTLIGHT.imageWaitMs - 1, paused: false, isReady: () => false }).state;
    expect(s.phase).toBe('WALL_IDLE');
    s = tick(s, { now: SPOTLIGHT.imageWaitMs + 1, paused: false, isReady: () => false }).state;
    expect(s.phase).toBe('SPOT_IN');
  });

  it('removes hidden attendees from the queue and aborts their spotlight', () => {
    let s = enqueue(initialQueue(), ['a', 'b', 'c']);
    s = removeId(s, 'b');
    expect(s.queue).toEqual(['a', 'c']);
    s = tick(s, { now: 10, paused: false, isReady: ready }).state;
    expect(s.current).toEqual(['a']);
    s = removeId(s, 'a');
    expect(s.phase).toBe('WALL_IDLE');
    expect(s.current).toEqual([]);
    expect(s.queue).toEqual(['c']);
  });

  it('catches up after a reload, capped', () => {
    const attendees = Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, createdAtMs: i * 1000, hidden: i === 15 }));
    expect(catchUpIds(attendees, null, 10)).toEqual([]);
    const ids = catchUpIds(attendees, 5000, 10);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain('a15');
    expect(ids.at(-1)).toBe('a19');
    expect(catchUpIds(attendees, 17000, 10)).toEqual(['a18', 'a19']);
  });
});
