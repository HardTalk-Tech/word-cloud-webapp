import { describe, expect, it } from 'vitest';
import { WALL_AREA, assignSlots, gridCapacity, gridSlot, wallWindow } from '@/lib/wall/slots';

const area = WALL_AREA;
const ids = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `a${i + from}`);

/** Simulate arrivals one by one, as the screen sees them. */
function arrive(n: number) {
  let slots = new Map<string, number>();
  const all: string[] = [];
  for (const id of ids(n)) {
    all.push(id);
    slots = assignSlots(slots, wallWindow(all));
  }
  return slots;
}

describe('gridSlot', () => {
  it('is a 5 × 5 grid of 25', () => {
    expect(gridCapacity()).toBe(25);
  });

  it('circles are equal, inside the wall area, and never overlap', () => {
    const rects = Array.from({ length: 25 }, (_, i) => gridSlot(i, area));
    for (const r of rects) {
      expect(r.w).toBeCloseTo(rects[0].w);
      expect(r.x).toBeGreaterThanOrEqual(area.x);
      expect(r.y).toBeGreaterThanOrEqual(area.y);
      expect(r.x + r.w).toBeLessThanOrEqual(area.x + area.w);
      expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
    }
    for (let i = 0; i < 25; i++) {
      for (let j = i + 1; j < 25; j++) {
        const a = rects[i];
        const b = rects[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        expect(dist).toBeGreaterThan(a.w);
      }
    }
  });

  it('fills in reading order', () => {
    expect(gridSlot(1, area).x).toBeGreaterThan(gridSlot(0, area).x);
    expect(gridSlot(5, area).y).toBeGreaterThan(gridSlot(0, area).y);
    expect(gridSlot(5, area).x).toBeCloseTo(gridSlot(0, area).x);
  });
});

describe('assignSlots', () => {
  it('the first 25 fill the grid in registration order', () => {
    const slots = arrive(25);
    for (let i = 1; i <= 25; i++) expect(slots.get(`a${i}`)).toBe(i - 1);
  });

  it('the 26th takes the first person’s spot; nobody else moves', () => {
    const before = arrive(25);
    const after = arrive(26);
    expect(after.has('a1')).toBe(false);
    expect(after.get('a26')).toBe(0);
    for (let i = 2; i <= 25; i++) expect(after.get(`a${i}`)).toBe(before.get(`a${i}`));
    expect(after.size).toBe(25);
  });

  it('with 700 arrivals the wall holds the newest 25, each in its own spot', () => {
    const slots = arrive(700);
    expect([...slots.keys()].sort()).toEqual(ids(25, 676).sort());
    expect(new Set(slots.values()).size).toBe(25);
    // Spots cycle: arrival n sits in spot (n - 1) mod 25.
    expect(slots.get('a700')).toBe(699 % 25);
  });

  it('a hidden person’s spot goes to the next-oldest, others stay', () => {
    const all = ids(30);
    let slots = new Map<string, number>();
    for (let n = 1; n <= 30; n++) slots = assignSlots(slots, wallWindow(all.slice(0, n)));
    const hiddenSlot = slots.get('a20')!;
    const next = assignSlots(slots, wallWindow(all.filter((id) => id !== 'a20')));
    expect(next.has('a20')).toBe(false);
    expect(next.get('a5')).toBe(hiddenSlot);
    for (const [id, s] of slots) if (id !== 'a20') expect(next.get(id)).toBe(s);
  });
});
