import { describe, expect, it } from 'vitest';
import { WALL_AREA, lerpPose, poseRect, ringCapacity, ringPose, ringSlot, ringWindow, slotRing } from '@/lib/wall/rings';

const area = WALL_AREA;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i + 1}`);

describe('ringCapacity / slotRing', () => {
  it('shows 25: centre, 8 inner, 16 outer', () => {
    expect(ringCapacity()).toBe(25);
    expect(slotRing(0)).toEqual({ ring: 0, k: 0, n: 1 });
    expect(slotRing(1)).toEqual({ ring: 1, k: 0, n: 8 });
    expect(slotRing(8)).toEqual({ ring: 1, k: 7, n: 8 });
    expect(slotRing(9)).toEqual({ ring: 2, k: 0, n: 16 });
    expect(slotRing(24)).toEqual({ ring: 2, k: 15, n: 16 });
  });
});

describe('ringWindow', () => {
  it('puts the newest in the centre slot', () => {
    expect(ringWindow(ids(3))).toEqual(['a3', 'a2', 'a1']);
  });

  it('keeps only the newest 25; the 26th arrival pushes the first one off', () => {
    const w25 = ringWindow(ids(25));
    expect(w25).toHaveLength(25);
    expect(w25.at(-1)).toBe('a1');
    const w26 = ringWindow(ids(26));
    expect(w26).toHaveLength(25);
    expect(w26[0]).toBe('a26');
    expect(w26).not.toContain('a1');
    expect(w26.at(-1)).toBe('a2');
  });

  it('backfills the last slot when someone on the wall is hidden', () => {
    const all = ids(30).filter((id) => id !== 'a28');
    const w = ringWindow(all);
    expect(w).toHaveLength(25);
    expect(w).not.toContain('a28');
    expect(w.at(-1)).toBe('a5');
  });

  it('only 700 attendees still shows 25', () => {
    expect(ringWindow(ids(700))).toHaveLength(25);
  });
});

describe('ringSlot', () => {
  const times = [0, 1234, 9000, 33333, 70000, 140000, 271828];

  it('centre slot is in the middle of the wall area', () => {
    const r = ringSlot(0, area, 0);
    expect(r.x + r.w / 2).toBeCloseTo(area.x + area.w / 2);
    expect(Math.abs(r.y + r.h / 2 - (area.y + area.h / 2))).toBeLessThanOrEqual(5);
  });

  it('centre circle is bigger than inner, inner bigger than outer', () => {
    expect(ringSlot(0, area, 0).w).toBeGreaterThan(ringSlot(1, area, 0).w);
    expect(ringSlot(1, area, 0).w).toBeGreaterThan(ringSlot(9, area, 0).w);
  });

  it('every circle stays inside the wall area and none overlap, as the rings turn', () => {
    for (const now of times) {
      const rects = Array.from({ length: ringCapacity() }, (_, i) => ringSlot(i, area, now));
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(area.x);
        expect(r.y).toBeGreaterThanOrEqual(area.y);
        expect(r.x + r.w).toBeLessThanOrEqual(area.x + area.w);
        expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const dist = Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
          expect(dist).toBeGreaterThan(a.w / 2 + b.w / 2);
        }
      }
    }
  });
});

describe('lerpPose', () => {
  it('ends exactly on the target slot', () => {
    const a = ringPose(3, area, 500);
    const b = ringPose(4, area, 500);
    const r = poseRect(lerpPose(a, b, 1), area);
    const t = poseRect(b, area);
    expect(r.x).toBeCloseTo(t.x);
    expect(r.y).toBeCloseTo(t.y);
    expect(r.w).toBeCloseTo(t.w);
  });

  it('leaving the centre heads straight for its inner-ring slot', () => {
    const a = ringPose(0, area, 0);
    const b = ringPose(1, area, 0);
    expect(lerpPose(a, b, 0.5).angle).toBeCloseTo(b.angle);
  });
});
