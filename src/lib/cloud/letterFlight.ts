// Letters flying out of the wordmark into a word in the crown (pure). Stage coordinates.

export type Point = { x: number; y: number };

/**
 * Landing point of each letter of a word drawn centred on `centre`, given each letter's advance width.
 * `rotate` 90 = the word reads bottom-to-top (as the cloud draws vertical words).
 */
export function letterTargets(centre: Point, widths: readonly number[], rotate: 0 | 90 = 0): Point[] {
  const total = widths.reduce((a, b) => a + b, 0);
  let along = -total / 2;
  return widths.map((w) => {
    const mid = along + w / 2;
    along += w;
    return rotate === 90 ? { x: centre.x, y: centre.y - mid } : { x: centre.x + mid, y: centre.y };
  });
}

/**
 * Point on a curve from `from` to `to` that lifts up first (control point above both ends), so letters rise
 * out of the wordmark and arc into the crown. `bend` pushes the arc sideways. p = 0..1.
 */
export function flightPoint(from: Point, to: Point, bend: number, lift: number, p: number): Point {
  const c = { x: (from.x + to.x) / 2 + bend, y: Math.min(from.y, to.y) - lift };
  const u = 1 - p;
  return {
    x: u * u * from.x + 2 * u * p * c.x + p * p * to.x,
    y: u * u * from.y + 2 * u * p * c.y + p * p * to.y,
  };
}

/** Start offsets (ms) so the letters of a word leave one after another. */
export function letterSchedule(count: number, staggerMs: number): number[] {
  return Array.from({ length: count }, (_, i) => i * staggerMs);
}
