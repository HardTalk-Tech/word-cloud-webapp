// Photo wall maths (pure). Stage coordinates.
// The newest 25 attendees sit still on a 5 × 5 grid; a newcomer takes a free spot or the oldest one's spot.
import { STAGE, WALL_GRID, WALL_HEADER_RATIO, WALL_PADDING } from '@/config/stage';
import type { Rect } from '@/lib/anim';

export type GridConfig = { cols: number; rows: number; fill: number };

/** Header band (logo) height on Screen 1. */
export const HEADER_H = Math.round(STAGE.height * WALL_HEADER_RATIO);

/** Everything under the header band. */
export const WALL_AREA: Rect = {
  x: WALL_PADDING,
  y: HEADER_H + WALL_PADDING / 2,
  w: STAGE.width - WALL_PADDING * 2,
  h: STAGE.height - HEADER_H - WALL_PADDING * 1.5,
};

export function gridCapacity(cfg: GridConfig = WALL_GRID): number {
  return cfg.cols * cfg.rows;
}

/** The square the grid occupies: square cells, centred in the area. */
export function gridBox(area: Rect, cfg: GridConfig = WALL_GRID): Rect {
  const cell = Math.min(area.w / cfg.cols, area.h / cfg.rows);
  const w = cell * cfg.cols;
  const h = cell * cfg.rows;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

/** Bounding square of the circle in grid spot `index` (reading order: left → right, top → bottom). */
export function gridSlot(index: number, area: Rect, cfg: GridConfig = WALL_GRID): Rect {
  const box = gridBox(area, cfg);
  const cell = box.w / cfg.cols;
  const d = cell * cfg.fill;
  const col = index % cfg.cols;
  const row = Math.floor(index / cfg.cols);
  return { x: box.x + col * cell + (cell - d) / 2, y: box.y + row * cell + (cell - d) / 2, w: d, h: d };
}

/** The attendees on the wall: ids in arrival order (oldest first) → the newest `capacity`, oldest first. */
export function wallWindow(ids: readonly string[], capacity: number = gridCapacity()): string[] {
  return ids.slice(-capacity);
}

/**
 * Keep everyone who is still on the wall in their spot; newcomers (oldest first) take the free spots,
 * lowest first. A free spot is one nobody had, or one whose person left (the oldest, pushed off by a
 * new arrival, or someone hidden).
 */
export function assignSlots(
  prev: ReadonlyMap<string, number>,
  window: readonly string[],
  capacity: number = gridCapacity(),
): Map<string, number> {
  const inWindow = new Set(window);
  const next = new Map<string, number>();
  const used = new Set<number>();
  for (const [id, slot] of prev) {
    if (inWindow.has(id) && slot < capacity) {
      next.set(id, slot);
      used.add(slot);
    }
  }
  const free: number[] = [];
  for (let s = 0; s < capacity; s++) if (!used.has(s)) free.push(s);
  for (const id of window) {
    if (next.has(id)) continue;
    const slot = free.shift();
    if (slot === undefined) break;
    next.set(id, slot);
  }
  return next;
}
