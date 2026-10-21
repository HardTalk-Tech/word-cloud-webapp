// Final mode on Screen 1: every visible attendee (on the rings or not) gathers into the crown.
import { FINAL } from '@/config/timings';
import { easeInOutCubic, lerpRect, progress, type Rect } from '@/lib/anim';
import type { MaskGrid } from '@/lib/mask/mask';
import { mosaicCells } from '@/lib/mask/mosaic';
import { rng } from '@/lib/random';

const OUT_MS = 1200;
const REFLOW_MS = 800;

export type FinalState = 'off' | 'in' | 'on' | 'out';

export class FinalMosaic {
  state: FinalState = 'off';
  private startedAt = 0;
  private cells = new Map<string, Rect>();
  private delays = new Map<string, number>();
  private reflowFrom = new Map<string, Rect>();
  private reflowAt = -Infinity;
  private key = '';

  constructor(private mask: MaskGrid | null) {}

  setMask(mask: MaskGrid) {
    this.mask = mask;
    this.key = '';
  }

  get active() {
    return this.state !== 'off';
  }

  enter(now: number, ids: string[]) {
    if (this.state === 'in' || this.state === 'on') return;
    this.state = 'in';
    this.startedAt = now;
    this.key = '';
    this.layout(ids, false);
    const random = rng(`final:${ids.length}`);
    this.delays = new Map(ids.map((id) => [id, random() * FINAL.maxStaggerMs]));
  }

  exit(now: number) {
    if (this.state === 'off' || this.state === 'out') return;
    this.state = 'out';
    this.startedAt = now;
  }

  /** Visible ids changed (arrivals / hides): recompute the mosaic and glide tiles to new cells. */
  update(ids: string[], now: number, currentRect: (id: string) => Rect | null) {
    if (this.state === 'off' || this.state === 'out') return;
    const key = ids.join(',');
    if (key === this.key) return;
    const before = new Map<string, Rect>();
    for (const id of ids) {
      const r = currentRect(id);
      if (r && this.cells.has(id)) before.set(id, r);
    }
    this.layout(ids, true);
    this.reflowFrom = before;
    this.reflowAt = now;
  }

  private layout(ids: string[], keepDelays: boolean) {
    this.key = ids.join(',');
    if (!this.mask) {
      this.cells = new Map();
      return;
    }
    const cells = mosaicCells(this.mask, ids.length);
    this.cells = new Map(ids.map((id, i) => [id, cells[i]]));
    if (keepDelays) for (const id of ids) if (!this.delays.has(id)) this.delays.set(id, 0);
  }

  tick(now: number) {
    if (this.state === 'in' && now - this.startedAt >= FINAL.totalMs) this.state = 'on';
    if (this.state === 'out' && now - this.startedAt >= OUT_MS) this.state = 'off';
  }

  isAnimating(now: number): boolean {
    if (this.state === 'in' || this.state === 'out') return true;
    return now - this.reflowAt < REFLOW_MS;
  }

  /** The tile's cell in the crown, if it is part of the mosaic. */
  cell(id: string): Rect | undefined {
    return this.cells.get(id);
  }

  /** Where to draw a tile, given its wall rect. null = not part of the mosaic (draw normally). */
  rect(id: string, wallRect: Rect, now: number): Rect | null {
    if (this.state === 'off') return null;
    const cell = this.cells.get(id);
    if (!cell) return this.state === 'out' ? null : wallRect;
    if (this.state === 'out') {
      return lerpRect(wallRect, cell, 1 - easeInOutCubic(progress(now, this.startedAt, OUT_MS)));
    }
    if (this.state === 'in') {
      const delay = this.delays.get(id) ?? 0;
      const p = progress(now, this.startedAt + delay, FINAL.totalMs - FINAL.maxStaggerMs);
      return lerpRect(wallRect, cell, easeInOutCubic(p));
    }
    const from = this.reflowFrom.get(id);
    if (from) {
      const p = progress(now, this.reflowAt, REFLOW_MS);
      if (p < 1) return lerpRect(from, cell, easeInOutCubic(p));
    }
    return cell;
  }

  /** 0..1 how "final" the screen is (header out, wordmark in). */
  amount(now: number): number {
    switch (this.state) {
      case 'off':
        return 0;
      case 'on':
        return 1;
      case 'in':
        return easeInOutCubic(progress(now, this.startedAt + FINAL.totalMs * 0.5, FINAL.wordmarkFadeMs));
      case 'out':
        return 1 - easeInOutCubic(progress(now, this.startedAt, OUT_MS * 0.6));
    }
  }
}
