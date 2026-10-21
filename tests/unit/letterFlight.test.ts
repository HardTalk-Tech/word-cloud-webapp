import { describe, expect, it } from 'vitest';
import { flightPoint, letterSchedule, letterTargets } from '@/lib/cloud/letterFlight';

describe('letterTargets', () => {
  it('one point per letter, centred on the word', () => {
    const pts = letterTargets({ x: 100, y: 50 }, [10, 20, 10]);
    expect(pts).toHaveLength(3);
    expect(pts.map((p) => p.x)).toEqual([85, 100, 115]);
    expect(pts.every((p) => p.y === 50)).toBe(true);
  });

  it('vertical words read bottom to top', () => {
    const pts = letterTargets({ x: 100, y: 50 }, [10, 10], 90);
    expect(pts.every((p) => p.x === 100)).toBe(true);
    expect(pts[0].y).toBeGreaterThan(pts[1].y);
    expect((pts[0].y + pts[1].y) / 2).toBe(50);
  });
});

describe('flightPoint', () => {
  const from = { x: 600, y: 1000 };
  const to = { x: 300, y: 400 };

  it('starts and ends exactly on the endpoints', () => {
    expect(flightPoint(from, to, 80, 120, 0)).toEqual(from);
    const end = flightPoint(from, to, 80, 120, 1);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
  });

  it('rises first: early points are above the start', () => {
    expect(flightPoint(from, to, 0, 120, 0.1).y).toBeLessThan(from.y);
  });
});

describe('letterSchedule', () => {
  it('letters leave one after another', () => {
    expect(letterSchedule(4, 70)).toEqual([0, 70, 140, 210]);
  });
});
