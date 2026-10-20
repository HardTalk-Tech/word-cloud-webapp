// Photo wall grid maths (pure). Stage coordinates.
import type { Rect } from '@/lib/anim';
import { rng } from '@/lib/random';

export const TIERS = [60, 150, 300, 500, 750, 1000] as const;
const OVERFLOW_STEP = 250;

export function chooseTier(count: number): number {
  for (const t of TIERS) if (count <= t) return t;
  return Math.ceil(count / OVERFLOW_STEP) * OVERFLOW_STEP;
}

export type GridFit = { cols: number; rows: number; size: number };

/** Largest square tile size such that cols × rows ≥ capacity fits inside the area. */
export function fitGrid(capacity: number, areaW: number, areaH: number, gap: number): GridFit {
  let best: GridFit = { cols: 1, rows: capacity, size: 0 };
  for (let cols = 1; cols <= capacity; cols++) {
    const rows = Math.ceil(capacity / cols);
    const size = Math.min((areaW - gap * (cols - 1)) / cols, (areaH - gap * (rows - 1)) / rows);
    if (size > best.size) best = { cols, rows, size };
  }
  return { ...best, size: Math.floor(best.size) };
}

export type WallLayout = {
  tier: number;
  cols: number;
  rows: number;
  size: number;
  /** Slots in fill order: attendee n (by createdAt) goes to slots[n]. */
  slots: Rect[];
};

/** How ragged the growing edge is (0 = perfect ellipse). */
const EDGE_JITTER = 0.35;

/**
 * Fill order that grows from the centre outward in an ellipse matching the grid's shape,
 * with a little seeded jitter so the edge looks organic rather than a hard diamond.
 */
export function centreOutOrder(cols: number, rows: number, seed: string): number[] {
  const random = rng(seed);
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const scored: { i: number; d: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = (c - cx) / cols;
      const dy = (r - cy) / rows;
      const d = Math.sqrt(dx * dx + dy * dy) * (1 + (random() - 0.5) * EDGE_JITTER);
      scored.push({ i: r * cols + c, d });
    }
  }
  return scored.sort((a, b) => a.d - b.d || a.i - b.i).map((s) => s.i);
}

export function computeWall(count: number, area: Rect, gap: number, seed = 'wall'): WallLayout {
  const tier = chooseTier(count);
  const { cols, rows, size } = fitGrid(tier, area.w, area.h, gap);
  const gridW = cols * size + (cols - 1) * gap;
  const gridH = rows * size + (rows - 1) * gap;
  const ox = area.x + (area.w - gridW) / 2;
  const oy = area.y + (area.h - gridH) / 2;

  const all: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      all.push({ x: ox + c * (size + gap), y: oy + r * (size + gap), w: size, h: size });
    }
  }
  // The wall grows from the centre outward; empty slots show as glass cells around it.
  const slots = centreOutOrder(cols, rows, `${seed}:${tier}:${cols}x${rows}`).map((i) => all[i]);
  return { tier, cols, rows, size, slots };
}
