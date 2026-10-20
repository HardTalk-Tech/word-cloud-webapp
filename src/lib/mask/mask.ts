// Crown silhouette → occupancy grid. The grid always covers the full stage.
import type { Rect } from '@/lib/anim';

export type MaskGrid = {
  cols: number;
  rows: number;
  /** Cell size in stage px. */
  cell: number;
  /** 1 = inside the crown. */
  inside: Uint8Array;
  insideCount: number;
  /** Centroid of inside cells, in cells. */
  centroid: { x: number; y: number };
  /** Bounds of inside cells, in cells (inclusive). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

/** Fit an image of iw×ih into `box`, preserving aspect, centred. */
export function containRect(iw: number, ih: number, box: Rect): Rect {
  const s = Math.min(box.w / iw, box.h / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/**
 * Build the grid from RGBA pixels of a canvas `width`×`height` (stage px).
 * A cell is inside when the alpha at its centre is ≥ threshold.
 */
export function maskFromAlpha(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  cell: number,
  threshold = 128,
): MaskGrid {
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  const inside = new Uint8Array(cols * rows);
  let count = 0;
  let sx = 0;
  let sy = 0;
  let minX = cols;
  let minY = rows;
  let maxX = -1;
  let maxY = -1;
  for (let r = 0; r < rows; r++) {
    const py = Math.min(height - 1, Math.floor(r * cell + cell / 2));
    for (let c = 0; c < cols; c++) {
      const px = Math.min(width - 1, Math.floor(c * cell + cell / 2));
      if (rgba[(py * width + px) * 4 + 3] >= threshold) {
        inside[r * cols + c] = 1;
        count++;
        sx += c;
        sy += r;
        if (c < minX) minX = c;
        if (c > maxX) maxX = c;
        if (r < minY) minY = r;
        if (r > maxY) maxY = r;
      }
    }
  }
  return {
    cols,
    rows,
    cell,
    inside,
    insideCount: count,
    centroid: count ? { x: sx / count, y: sy / count } : { x: cols / 2, y: rows / 2 },
    bounds: { minX, minY, maxX, maxY },
  };
}

export function isInside(mask: MaskGrid, stageX: number, stageY: number): boolean {
  const c = Math.floor(stageX / mask.cell);
  const r = Math.floor(stageY / mask.cell);
  if (c < 0 || r < 0 || c >= mask.cols || r >= mask.rows) return false;
  return mask.inside[r * mask.cols + c] === 1;
}

export type LoadedMask = { image: HTMLImageElement; rect: Rect; grid: MaskGrid };

/** Browser: draw the mask PNG into `box` on a stage-sized canvas and sample it. */
export async function loadMask(
  url: string,
  stageW: number,
  stageH: number,
  box: Rect,
  cell: number,
): Promise<LoadedMask> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const rect = containRect(image.naturalWidth, image.naturalHeight, box);
  const canvas = document.createElement('canvas');
  canvas.width = stageW;
  canvas.height = stageH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  const data = ctx.getImageData(0, 0, stageW, stageH).data;
  canvas.width = 0;
  canvas.height = 0;
  return { image, rect, grid: maskFromAlpha(data, stageW, stageH, cell) };
}
