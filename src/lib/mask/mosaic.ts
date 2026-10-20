// Photo-mosaic cells inside the crown (pure).
import type { Rect } from '@/lib/anim';
import { rng, shuffled } from '@/lib/random';
import { isInside, type MaskGrid } from './mask';

const GAP_RATIO = 0.08;

function cellsForSize(mask: MaskGrid, size: number): Rect[] {
  const { bounds, cell } = mask;
  const gap = Math.max(1, Math.round(size * GAP_RATIO));
  const step = size + gap;
  const x0 = bounds.minX * cell;
  const y0 = bounds.minY * cell;
  const x1 = (bounds.maxX + 1) * cell;
  const y1 = (bounds.maxY + 1) * cell;
  // Centre the lattice on the crown bounds.
  const cols = Math.floor((x1 - x0 + gap) / step);
  const rows = Math.floor((y1 - y0 + gap) / step);
  const ox = x0 + (x1 - x0 - (cols * step - gap)) / 2;
  const oy = y0 + (y1 - y0 - (rows * step - gap)) / 2;
  const inset = Math.min(2, size / 4);
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * step;
      const y = oy + r * step;
      if (
        isInside(mask, x + inset, y + inset) &&
        isInside(mask, x + size - inset, y + inset) &&
        isInside(mask, x + inset, y + size - inset) &&
        isInside(mask, x + size - inset, y + size - inset) &&
        isInside(mask, x + size / 2, y + size / 2)
      ) {
        out.push({ x, y, w: size, h: size });
      }
    }
  }
  return out;
}

/** Largest square tile size with ≥ n cells inside the crown; returns n cells (seeded pick). */
export function mosaicCells(mask: MaskGrid, n: number, seed = 'mosaic'): Rect[] {
  if (n <= 0) return [];
  let lo = 3;
  let hi = 320;
  let best: Rect[] = cellsForSize(mask, lo);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cells = cellsForSize(mask, mid);
    if (cells.length >= n) {
      best = cells;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  // Even at the smallest size we may not fit everyone: reuse cells rather than drop people.
  const picked = shuffled(best, rng(`${seed}:${n}`)).slice(0, n);
  while (picked.length < n && best.length) picked.push(best[picked.length % best.length]);
  // Reading order looks calmer when tiles settle.
  return picked.sort((a, b) => a.y - b.y || a.x - b.x);
}
