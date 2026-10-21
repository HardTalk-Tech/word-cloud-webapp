// Ring wall maths (pure). Stage coordinates.
// The newest attendees sit on concentric rings: slot 0 = centre, then the inner ring, then the outer.
import { RING_WALL, STAGE, WALL_HEADER_RATIO, WALL_PADDING } from '@/config/stage';
import { WALL } from '@/config/timings';
import { lerp, type Rect } from '@/lib/anim';

export type RingConfig = {
  rings: readonly number[];
  diameter: readonly number[];
  radiusX: readonly number[];
  radiusY: readonly number[];
};

export type RingMotion = {
  ringRevMs: readonly number[];
  bobPx: number;
  bobMs: number;
};

/** Where a circle is on the rings: centre-relative ellipse radii + angle, and its diameter. */
export type Pose = { rx: number; ry: number; angle: number; d: number; bob: number };

const TAU = Math.PI * 2;

/** Header band (logo) height on Screen 1. */
export const HEADER_H = Math.round(STAGE.height * WALL_HEADER_RATIO);

/** Where the rings live: everything under the header band. */
export const WALL_AREA: Rect = {
  x: WALL_PADDING,
  y: HEADER_H + WALL_PADDING / 2,
  w: STAGE.width - WALL_PADDING * 2,
  h: STAGE.height - HEADER_H - WALL_PADDING * 1.5,
};

export function ringCapacity(cfg: RingConfig = RING_WALL): number {
  return cfg.rings.reduce((a, b) => a + b, 0);
}

/** Ring index + position within the ring for a slot. */
export function slotRing(index: number, cfg: RingConfig = RING_WALL): { ring: number; k: number; n: number } {
  let start = 0;
  for (let ring = 0; ring < cfg.rings.length; ring++) {
    const n = cfg.rings[ring];
    if (index < start + n) return { ring, k: index - start, n };
    start += n;
  }
  const last = cfg.rings.length - 1;
  return { ring: last, k: cfg.rings[last] - 1, n: cfg.rings[last] };
}

/**
 * The attendees on the wall: ids in arrival order (oldest first) → the newest `capacity`, newest first.
 * Index in the result = slot.
 */
export function ringWindow(ids: readonly string[], capacity: number = ringCapacity()): string[] {
  return ids.slice(-capacity).reverse();
}

/**
 * Pose of a slot at time `now`: rings turn slowly (inner and outer in opposite directions) and every
 * circle floats a little. Each ring starts at the top and fills clockwise.
 */
export function ringPose(
  index: number,
  area: Rect,
  now: number,
  cfg: RingConfig = RING_WALL,
  motion: RingMotion = WALL,
): Pose {
  const { ring, k, n } = slotRing(index, cfg);
  const rev = motion.ringRevMs[ring] ?? 0;
  const turn = rev === 0 ? 0 : (now / rev) * TAU;
  return {
    rx: cfg.radiusX[ring] * (area.w / 2),
    ry: cfg.radiusY[ring] * (area.h / 2),
    angle: -Math.PI / 2 + (k / n) * TAU + turn,
    d: cfg.diameter[ring] * area.h,
    bob: motion.bobPx * Math.sin((now / motion.bobMs) * TAU + index * 1.7),
  };
}

/** Shortest-way angle blend, so circles glide round the ring rather than across it. */
function lerpAngle(a: number, b: number, t: number): number {
  let delta = (b - a) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return a + delta * t;
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  // The centre has no angle of its own: leave it along the angle of where it is going.
  const fromAngle = a.rx === 0 && a.ry === 0 ? b.angle : a.angle;
  const toAngle = b.rx === 0 && b.ry === 0 ? fromAngle : b.angle;
  return {
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
    angle: lerpAngle(fromAngle, toAngle, t),
    d: lerp(a.d, b.d, t),
    bob: lerp(a.bob, b.bob, t),
  };
}

/** Square bounding box of the circle for a pose (`spread` pushes it outward, e.g. when leaving). */
export function poseRect(p: Pose, area: Rect, spread = 1): Rect {
  const cx = area.x + area.w / 2 + Math.cos(p.angle) * p.rx * spread;
  const cy = area.y + area.h / 2 + Math.sin(p.angle) * p.ry * spread + p.bob;
  return { x: cx - p.d / 2, y: cy - p.d / 2, w: p.d, h: p.d };
}

export function ringSlot(index: number, area: Rect, now: number, cfg: RingConfig = RING_WALL, motion: RingMotion = WALL): Rect {
  return poseRect(ringPose(index, area, now, cfg, motion), area);
}
