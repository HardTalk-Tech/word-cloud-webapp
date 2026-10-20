import { describe, expect, it } from 'vitest';
import { chooseTier, computeWall, fitGrid, TIERS } from '@/lib/wall/grid';

const area = { x: 24, y: 100, w: 1200, h: 1046 };

describe('chooseTier', () => {
  it('picks the smallest tier ≥ count', () => {
    expect(chooseTier(0)).toBe(60);
    expect(chooseTier(60)).toBe(60);
    expect(chooseTier(61)).toBe(150);
    expect(chooseTier(999)).toBe(1000);
    expect(chooseTier(1001)).toBe(1250);
  });
});

describe('fitGrid', () => {
  it('has capacity for the tier and fits the area', () => {
    for (const tier of TIERS) {
      const g = fitGrid(tier, area.w, area.h, 4);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(tier);
      expect(g.cols * g.size + (g.cols - 1) * 4).toBeLessThanOrEqual(area.w);
      expect(g.rows * g.size + (g.rows - 1) * 4).toBeLessThanOrEqual(area.h);
      expect(g.size).toBeGreaterThan(0);
    }
  });
});

describe('computeWall', () => {
  it('slots fit the stage area and never overlap', () => {
    for (const count of [1, 60, 149, 300, 777, 1000]) {
      const wall = computeWall(count, area, 4);
      expect(wall.slots.length).toBeGreaterThanOrEqual(count);
      for (const s of wall.slots) {
        expect(s.x).toBeGreaterThanOrEqual(area.x - 0.001);
        expect(s.y).toBeGreaterThanOrEqual(area.y - 0.001);
        expect(s.x + s.w).toBeLessThanOrEqual(area.x + area.w + 0.001);
        expect(s.y + s.h).toBeLessThanOrEqual(area.y + area.h + 0.001);
      }
      const keys = new Set(wall.slots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`));
      expect(keys.size).toBe(wall.slots.length);
      // Square tiles with a gap: distinct grid positions mean no overlap.
      const xs = [...new Set(wall.slots.map((s) => Math.round(s.x)))].sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(wall.size);
    }
  });

  it('is deterministic and fills from the centre outward, balanced on all sides', () => {
    const a = computeWall(40, area, 4);
    const b = computeWall(40, area, 4);
    expect(a.slots).toEqual(b.slots);
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h / 2;
    const dist = (s: { x: number; y: number; w: number }) => Math.hypot(s.x + s.w / 2 - cx, s.y + s.w / 2 - cy);
    // The first slots hug the centre; the last ones are out at the edges.
    const firstAvg = a.slots.slice(0, 12).reduce((t, s) => t + dist(s), 0) / 12;
    const lastAvg = a.slots.slice(-12).reduce((t, s) => t + dist(s), 0) / 12;
    expect(firstAvg).toBeLessThan(lastAvg / 3);
    const first = a.slots.slice(0, 20);
    const left = first.filter((s) => s.x + s.w / 2 < cx).length;
    const top = first.filter((s) => s.y + s.w / 2 < cy).length;
    expect(left).toBeGreaterThan(5);
    expect(left).toBeLessThan(15);
    expect(top).toBeGreaterThan(5);
    expect(top).toBeLessThan(15);
  });
});
