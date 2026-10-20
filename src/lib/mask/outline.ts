// Evenly spaced points just outside the crown silhouette (pure): the "dotted arch" lights.
import type { MaskGrid } from './mask';

export type OutlineDot = { x: number; y: number };

/**
 * Points `offsetCells` outside the mask edge, at least `spacingPx` apart, ordered by angle
 * around the crown centroid (so a light "chase" can run along the outline).
 */
export function outlineDots(mask: MaskGrid, offsetCells: number, spacingPx: number): OutlineDot[] {
  const { cols, rows, inside, cell } = mask;
  // Distance (in cells, 4-neighbour) from the silhouette, out to offsetCells.
  const dist = new Int16Array(cols * rows).fill(-1);
  let frontier: number[] = [];
  for (let i = 0; i < inside.length; i++) {
    if (inside[i]) {
      dist[i] = 0;
      frontier.push(i);
    }
  }
  for (let d = 1; d <= offsetCells && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % cols;
      const y = (i - x) / cols;
      const nb = [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y > 0 ? i - cols : -1, y < rows - 1 ? i + cols : -1];
      for (const j of nb) {
        if (j >= 0 && dist[j] === -1) {
          dist[j] = d;
          next.push(j);
        }
      }
    }
    frontier = next;
  }

  // Greedy pick on the ring, keeping points spacingPx apart (spatial hash for speed).
  const bucket = Math.max(1, spacingPx);
  const grid = new Map<string, OutlineDot[]>();
  const out: OutlineDot[] = [];
  const near = (p: OutlineDot) => {
    const bx = Math.floor(p.x / bucket);
    const by = Math.floor(p.y / bucket);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const q of grid.get(`${bx + dx},${by + dy}`) ?? []) {
          if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < spacingPx * spacingPx) return true;
        }
      }
    }
    return false;
  };
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] !== offsetCells) continue;
    const x = i % cols;
    const p = { x: (x + 0.5) * cell, y: ((i - x) / cols + 0.5) * cell };
    if (near(p)) continue;
    out.push(p);
    const k = `${Math.floor(p.x / bucket)},${Math.floor(p.y / bucket)}`;
    const list = grid.get(k);
    if (list) list.push(p);
    else grid.set(k, [p]);
  }

  const cx = (mask.centroid.x + 0.5) * cell;
  const cy = (mask.centroid.y + 0.5) * cell;
  return out.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}
