// Screen 1 engine: data → queue → one rAF loop drawing wall, spotlight and final mosaic.
import { BRAND } from '@/config/brand';
import { STAGE, WALL_GAP } from '@/config/stage';
import { SPOTLIGHT, WALL } from '@/config/timings';
import { progress, type Rect } from '@/lib/anim';
import { ensureFonts, fontFamilies, type FontFamilies } from '@/lib/fonts';
import { ImageCache } from '@/lib/images/cache';
import { containRect, loadMask } from '@/lib/mask/mask';
import { chooseTier, computeWall, type WallLayout } from '@/lib/wall/grid';
import { catchUpIds, enqueue, initialQueue, removeId, tick, type QueueState } from '@/lib/wall/queue';
import { DEFAULT_CONTROL, type Attendee, type ControlState, type WallAttendee } from '@/types/models';
import { drawWordmark, loadBrandImages, setupCanvas, type BrandImages } from '@/components/stage/canvas';
import type { DebugStats } from '@/components/stage/DebugOverlay';
import { FinalMosaic } from './FinalMosaic';
import { SpotlightRenderer, type SpotPerson } from './SpotlightRenderer';
import {
  WALL_AREA,
  WallSprites,
  drawBackground,
  drawGlassLayer,
  drawGlowTile,
  drawHeader,
  drawLandGlow,
  drawRing,
  drawSweep,
  drawTile,
  drawWatermark,
  isTileAnimating,
  tileFx,
  tileRect,
  type TileState,
} from './WallRenderer';

const W = STAGE.width;
const H = STAGE.height;
const MOVE_MS = 700;
/** Crown area for the final mosaic; the wordmark sits below it. */
const FINAL_BOX: Rect = { x: W * 0.05, y: H * 0.04, w: W * 0.9, h: H * 0.76 };
const FINAL_WORDMARK_Y = H * 0.885;
/** When only the slow new-arrival rings are fading, redraw at this interval instead of every frame. */
const SLOW_REDRAW_MS = 100;

type Tile = TileState & { visible: boolean };
type Stored = { epoch: number; lastAt: number };

const storeKey = (eventId: string) => `ew:main:${eventId}`;

function toWall(a: Attendee): WallAttendee | null {
  if (!a.createdAt) return null;
  return {
    id: a.id,
    name: a.name,
    department: a.department,
    spotUrl: a.spotUrl,
    tileUrl: a.tileUrl,
    lqip: a.lqip,
    hidden: a.hidden,
    createdAtMs: a.createdAt.toMillis(),
  };
}

export class MainEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fonts: FontFamilies;
  private readonly cache: ImageCache;
  private readonly spot: SpotlightRenderer;
  private readonly final = new FinalMosaic(null);

  private attendees = new Map<string, WallAttendee>();
  private order: string[] = [];
  private seen = new Set<string>();
  /** Ids from before the last reset; ignored even if their docs still exist. */
  private stale = new Set<string>();
  private serverFresh = false;
  private initialised = false;
  private queue: QueueState = initialQueue();
  private control: ControlState = DEFAULT_CONTROL;
  private controlLoaded = false;
  private layout: WallLayout = computeWall(0, WALL_AREA, WALL_GAP);
  private tiles = new Map<string, Tile>();
  private shownWhilePaused = new Set<string>();

  private brand: BrandImages = { crown: null, wordmark: null };
  private watermarkRect: Rect | null = null;
  /** Where the crown sits in final mode: the faint crown is drawn here behind the photo mosaic. */
  private finalCrownRect: Rect | null = null;

  private readonly sprites = new WallSprites();
  /** Every slot as a glass cell; photos are drawn on top. Rebuilt when the grid changes. */
  private glassLayer: HTMLCanvasElement | null = null;
  /** New arrivals → when they appeared (soft red ring fading over WALL.newArrivalMs). */
  private recent = new Map<string, number>();
  private sweepAt = -Infinity;
  private nextSweepAt = 0;
  private lastDrawAt = 0;

  private ambient: { id: string; start: number } | null = null;
  private nextAmbientAt = 0;
  private dirty = true;
  private tilesAnimating = false;
  private visibleIdsKey = '';
  private visibleCount = 0;

  private raf = 0;
  private destroyed = false;
  private frames = 0;
  private drawn = 0;
  private fps = 0;
  private drawFps = 0;
  private fpsAt = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    confettiCanvas: HTMLCanvasElement | null,
    private readonly eventId: string,
  ) {
    this.ctx = setupCanvas(canvas, W, H, { transparent: true });
    this.fonts = fontFamilies();
    this.cache = new ImageCache(12, () => {
      this.dirty = true;
    });
    this.spot = new SpotlightRenderer(this.fonts, confettiCanvas);
    this.glassLayer = this.sprites.glassLayer(this.layout.slots);
    this.nextSweepAt = performance.now() + WALL.sweepEveryMinMs;
  }

  async init() {
    const [brand] = await Promise.all([loadBrandImages(), ensureFonts(this.fonts)]);
    if (this.destroyed) return;
    this.brand = brand;
    if (brand.crown) {
      // Watermark: the real crown, centred in the wall area.
      this.watermarkRect = containRect(brand.crown.naturalWidth, brand.crown.naturalHeight, {
        x: WALL_AREA.x + WALL_AREA.w * 0.1,
        y: WALL_AREA.y + WALL_AREA.h * 0.1,
        w: WALL_AREA.w * 0.8,
        h: WALL_AREA.h * 0.8,
      });
    }
    this.dirty = true;
    try {
      // The silhouette has the same crop box as crown.png, so both land on the same rect.
      const m = await loadMask(BRAND.crownMask, W, H, FINAL_BOX, 4);
      if (this.destroyed) return;
      this.final.setMask(m.grid);
      this.finalCrownRect = m.rect;
    } catch (e) {
      console.warn('Crown mask failed to load', e);
    }
    this.dirty = true;
  }

  start() {
    const loop = () => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(performance.now());
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.spot.reset();
    this.cache.clear();
  }

  // ── Data ────────────────────────────────────────────────────────────

  onControl(next: ControlState) {
    const now = performance.now();
    const prev = this.control;
    if (this.controlLoaded && next.epoch !== prev.epoch) this.resetLocal();
    this.control = next;
    this.controlLoaded = true;
    if (next.mode === 'final' && !this.final.active) this.enterFinal(now);
    if (next.mode === 'final' && this.final.state === 'out') this.enterFinal(now);
    if (next.mode === 'live' && this.final.active) this.final.exit(now);
    this.maybeInit();
    this.dirty = true;
  }

  onAttendees(list: Attendee[], fromCache: boolean) {
    const now = performance.now();
    // Everyone in the snapshot that initialises the wall is history: show them without a pop / ring.
    const wasInitialised = this.initialised;
    const next = list.map(toWall).filter((a): a is WallAttendee => a !== null && !this.stale.has(a.id));
    const ids = new Set(next.map((a) => a.id));
    for (const id of this.attendees.keys()) {
      if (!ids.has(id)) {
        this.queue = removeId(this.queue, id);
        this.tiles.delete(id);
      }
    }
    this.attendees = new Map(next.map((a) => [a.id, a]));
    this.order = next.map((a) => a.id);
    if (!fromCache) this.serverFresh = true;

    if (this.initialised) {
      const fresh = next.filter((a) => !this.seen.has(a.id));
      fresh.forEach((a) => this.seen.add(a.id));
      this.queue = enqueue(
        this.queue,
        fresh.filter((a) => !a.hidden).map((a) => a.id),
      );
    } else {
      // Before the first server snapshot everything on screen counts as old.
      next.forEach((a) => this.seen.add(a.id));
      this.maybeInit();
    }
    for (const a of next) {
      if (a.hidden) {
        this.queue = removeId(this.queue, a.id);
        if (this.ambient?.id === a.id) this.ambient = null;
      }
    }

    for (const a of next) {
      if (a.hidden) continue;
      void this.cache.load(a.lqip);
      void this.cache.load(a.tileUrl);
    }
    this.preloadSpots();
    this.relayout(now, !wasInitialised);
    this.dirty = true;
  }

  private maybeInit() {
    if (this.initialised || !this.serverFresh || !this.controlLoaded) return;
    this.initialised = true;
    const stored = this.readStored();
    const lastAt = stored && stored.epoch === this.control.epoch ? stored.lastAt : null;
    const list = this.order.map((id) => this.attendees.get(id)!);
    list.forEach((a) => this.seen.add(a.id));
    this.queue = enqueue(this.queue, catchUpIds(list, lastAt, SPOTLIGHT.reloadCatchUpMax));
    if (!stored || stored.epoch !== this.control.epoch) this.writeStored(list.at(-1)?.createdAtMs ?? 0);
    this.preloadSpots();
  }

  /**
   * Event reset (epoch bump): clear the wall, queue, image cache and catch-up marker.
   * Docs that still exist while the dashboard deletes them are marked stale and ignored.
   */
  private resetLocal() {
    this.queue = initialQueue();
    this.cache.clear();
    this.shownWhilePaused.clear();
    this.ambient = null;
    for (const id of this.attendees.keys()) {
      this.seen.add(id);
      this.stale.add(id);
    }
    this.attendees.clear();
    this.order = [];
    this.tiles.clear();
    this.recent.clear();
    this.layout = computeWall(0, WALL_AREA, WALL_GAP);
    this.glassLayer = this.sprites.glassLayer(this.layout.slots);
    this.spot.reset();
    try {
      localStorage.removeItem(storeKey(this.eventId));
    } catch {
      // ignore
    }
  }

  private preloadSpots() {
    const ids = [...this.queue.current, ...this.queue.queue.slice(0, 8)];
    for (const id of ids) {
      const a = this.attendees.get(id);
      if (a) void this.cache.load(a.spotUrl, true);
    }
  }

  private relayout(now: number, instant: boolean) {
    const count = this.order.length;
    const tierChanged = chooseTier(count) !== this.layout.tier;
    if (tierChanged) {
      this.layout = computeWall(count, WALL_AREA, WALL_GAP);
      this.glassLayer = this.sprites.glassLayer(this.layout.slots);
    }
    this.order.forEach((id, i) => {
      const slot = this.layout.slots[i];
      const t = this.tiles.get(id);
      if (!t) {
        const a = this.attendees.get(id)!;
        this.tiles.set(id, {
          from: slot,
          to: slot,
          moveStart: -Infinity,
          moveMs: 0,
          appearAt: now,
          appear: 'none',
          hideAt: null,
          visible: instant && this.isVisible(a),
        });
      } else if (t.to.x !== slot.x || t.to.y !== slot.y || t.to.w !== slot.w) {
        t.from = tileRect(t, now);
        t.to = slot;
        t.moveStart = now;
        t.moveMs = tierChanged ? WALL.tierChangeMs : MOVE_MS;
      }
    });
  }

  // ── Frame ───────────────────────────────────────────────────────────

  private paused() {
    return this.control.welcomePaused || this.final.active;
  }

  private isVisible(a: WallAttendee): boolean {
    if (a.hidden) return false;
    if (this.queue.current.includes(a.id)) return false;
    if (this.queue.queue.includes(a.id)) return this.paused() || this.shownWhilePaused.has(a.id);
    return true;
  }

  private spotReady = (id: string) => {
    const a = this.attendees.get(id);
    return !a || this.cache.isReady(a.spotUrl);
  };

  private enterFinal(now: number) {
    // Land any spotlight in progress so everyone is on the wall.
    if (this.queue.current.length) {
      this.landed(this.queue.current, now);
      this.queue = { ...this.queue, phase: 'WALL_IDLE', current: [], waitingSince: null };
    }
    this.ambient = null;
    this.final.enter(now, this.visibleIds());
    this.visibleIdsKey = '';
  }

  private visibleIds(): string[] {
    return this.order.filter((id) => {
      const a = this.attendees.get(id);
      return a ? this.isVisible(a) : false;
    });
  }

  private markRecent(id: string, now: number) {
    this.recent.delete(id);
    this.recent.set(id, now);
    // Keep only the newest few (Map keeps insertion order).
    while (this.recent.size > WALL.newArrivalMax) this.recent.delete(this.recent.keys().next().value!);
  }

  private landed(ids: string[], now: number) {
    let lastAt = this.readStored()?.lastAt ?? 0;
    for (const id of ids) {
      const t = this.tiles.get(id);
      if (t) {
        t.appear = 'land';
        t.appearAt = now;
      }
      const a = this.attendees.get(id);
      if (a) lastAt = Math.max(lastAt, a.createdAtMs);
    }
    this.writeStored(lastAt);
  }

  private frame(now: number) {
    this.frames++;
    if (now - this.fpsAt >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsAt));
      this.drawFps = Math.round((this.drawn * 1000) / (now - this.fpsAt));
      this.frames = 0;
      this.drawn = 0;
      this.fpsAt = now;
    }

    const paused = this.paused();
    if (paused) for (const id of this.queue.queue) this.shownWhilePaused.add(id);
    const r = tick(this.queue, { now, paused, isReady: this.spotReady });
    if (r.state !== this.queue) {
      this.queue = r.state;
      this.dirty = true;
    }
    for (const e of r.events) {
      if (e.type === 'start') {
        this.spot.takeSnapshot(this.canvas);
        this.spot.burst();
        this.preloadSpots();
      } else if (e.type === 'landed') {
        this.landed(e.ids, now);
      }
    }
    this.final.tick(now);

    const idle = this.queue.phase === 'WALL_IDLE';
    const ambientActive = this.ambient !== null || (!this.final.active && idle && now >= this.nextAmbientAt);
    // Light sweep every 20–30 s while nothing else is on screen.
    if (idle && now >= this.nextSweepAt && now - this.sweepAt > WALL.sweepMs) {
      this.sweepAt = now;
      this.nextSweepAt = now + WALL.sweepEveryMinMs + Math.random() * (WALL.sweepEveryMaxMs - WALL.sweepEveryMinMs);
    }
    const sweeping = now - this.sweepAt < WALL.sweepMs;
    for (const [id, at] of this.recent) if (now - at >= WALL.newArrivalMs) this.recent.delete(id);

    const fast =
      !idle || this.final.isAnimating(now) || this.tilesAnimating || ambientActive || sweeping;
    const slow = this.recent.size > 0 && now - this.lastDrawAt >= SLOW_REDRAW_MS;
    if (!this.dirty && !fast && !slow) return;
    this.draw(now);
    this.lastDrawAt = now;
    this.drawn++;
    this.dirty = false;
  }

  private draw(now: number) {
    const ctx = this.ctx;
    drawBackground(ctx);
    const fin = this.final.amount(now);
    drawWatermark(ctx, this.brand.crown, this.watermarkRect, 1 - fin);
    // Final mode: the real crown, faint, behind the photo mosaic so the design reads through it.
    if (fin > 0 && this.brand.crown && this.finalCrownRect) {
      const r = this.finalCrownRect;
      ctx.save();
      ctx.globalAlpha = 0.28 * fin;
      ctx.drawImage(this.brand.crown, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
    drawHeader(ctx, this.fonts, this.brand, 1 - fin);

    if (this.final.active) {
      const ids = this.visibleIds();
      const key = ids.join(',');
      if (key !== this.visibleIdsKey) {
        this.visibleIdsKey = key;
        this.final.update(ids, now, (id) => {
          const t = this.tiles.get(id);
          return t ? tileRect(t, now) : null;
        });
      }
    }

    // Empty slots as dim glass cells (the wall looks complete from the first minute).
    drawGlassLayer(ctx, this.glassLayer, 1 - fin);

    // Pass 1: visibility changes + where each tile is this frame.
    const drawList: { id: string; t: Tile; rect: Rect; sprite: HTMLCanvasElement | null }[] = [];
    let anim = false;
    for (const id of this.order) {
      const a = this.attendees.get(id);
      const t = this.tiles.get(id);
      if (!a || !t) continue;
      const vis = this.isVisible(a);
      if (vis && !t.visible) {
        t.visible = true;
        t.hideAt = null;
        if (!(t.appear === 'land' && now - t.appearAt < 50)) {
          t.appear = 'pop';
          t.appearAt = now;
        }
        if (this.initialised) this.markRecent(id, now);
      } else if (!vis && t.visible) {
        t.visible = false;
        t.hideAt = a.hidden ? now : null;
        this.recent.delete(id);
      }
      const fading = t.hideAt !== null && now - t.hideAt < WALL.hideFadeMs;
      if (!t.visible && !fading) continue;
      const wallR = tileRect(t, now);
      const rect = this.final.rect(id, wallR, now) ?? wallR;
      const img = this.cache.get(a.tileUrl) ?? this.cache.get(a.lqip) ?? null;
      drawList.push({ id, t, rect, sprite: this.sprites.tile(img) });
      if (!anim && isTileAnimating(t, now)) anim = true;
    }
    this.tilesAnimating = anim;

    // Pass 2: red flash in the slot where a photo just landed / popped in (under the tile).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of drawList) {
      if (d.t.appear !== 'none' && now - d.t.appearAt < WALL.landGlowMs) {
        drawLandGlow(ctx, this.sprites, d.rect, (now - d.t.appearAt) / WALL.landGlowMs);
      }
    }
    ctx.restore();

    // Pass 3: rounded photo tiles.
    const visibleList: string[] = [];
    for (const d of drawList) {
      if (d.t.visible) visibleList.push(d.id);
      if (this.ambient?.id === d.id) continue;
      const fx = tileFx(d.t, now);
      drawTile(ctx, d.sprite, this.sprites, d.rect, fx.scale, fx.alpha);
    }
    this.visibleCount = visibleList.length;

    // Pass 4: soft red ring on the newest arrivals, fading out.
    if (this.recent.size && fin < 1) {
      ctx.save();
      for (const d of drawList) {
        const at = this.recent.get(d.id);
        if (at === undefined || !d.t.visible) continue;
        const p = (now - at) / WALL.newArrivalMs;
        drawRing(ctx, this.sprites, d.rect, (1 - p) ** 1.5 * (1 - fin));
      }
      ctx.restore();
    }

    // Ambient glow on one random tile.
    if (!this.final.active && this.queue.phase === 'WALL_IDLE') {
      if (!this.ambient && now >= this.nextAmbientAt && visibleList.length) {
        this.ambient = { id: visibleList[Math.floor(Math.random() * visibleList.length)], start: now };
      }
      if (this.ambient) {
        const p = progress(now, this.ambient.start, WALL.ambientDurationMs);
        const a = this.attendees.get(this.ambient.id);
        const t = this.tiles.get(this.ambient.id);
        if (a && t && t.visible) {
          const img = this.cache.get(a.tileUrl) ?? this.cache.get(a.lqip) ?? null;
          drawGlowTile(ctx, this.sprites.tile(img), this.sprites, tileRect(t, now), p);
        }
        if (p >= 1 || !a || !t?.visible) {
          this.ambient = null;
          this.nextAmbientAt =
            now + WALL.ambientEveryMinMs + Math.random() * (WALL.ambientEveryMaxMs - WALL.ambientEveryMinMs);
        }
      }
    } else if (this.ambient) {
      this.ambient = null;
    }

    // Diagonal shine across the photos and glass cells.
    if (this.queue.phase === 'WALL_IDLE') drawSweep(ctx, this.sprites, (now - this.sweepAt) / WALL.sweepMs);

    if (fin > 0) {
      drawWordmark(ctx, {
        x: W / 2,
        y: FINAL_WORDMARK_Y,
        // Wordmark only: the photo mosaic is the crown.
        height: 64 + 8 * fin,
        align: 'center',
        fonts: this.fonts,
        brand: this.brand,
        crown: false,
        alpha: fin,
      });
    }

    if (this.queue.phase !== 'WALL_IDLE') {
      const q = this.queue;
      const dur = q.phase === 'SPOT_IN' ? SPOTLIGHT.inMs : q.phase === 'SPOT_HOLD' ? q.holdMs : SPOTLIGHT.flyMs;
      const people: SpotPerson[] = q.current.map((id) => {
        const a = this.attendees.get(id);
        const t = this.tiles.get(id);
        const img = a ? (this.cache.get(a.spotUrl) ?? this.cache.get(a.tileUrl) ?? this.cache.get(a.lqip) ?? null) : null;
        return { id, name: a?.name ?? '', department: a?.department ?? '', img, target: t ? tileRect(t, now) : null };
      });
      this.spot.draw(ctx, q.phase, progress(now, q.phaseStartedAt, dur), people);
    }
  }

  // ── Storage + stats ─────────────────────────────────────────────────

  private readStored(): Stored | null {
    try {
      const raw = localStorage.getItem(storeKey(this.eventId));
      if (!raw) return null;
      const v = JSON.parse(raw) as Partial<Stored>;
      return typeof v.epoch === 'number' && typeof v.lastAt === 'number' ? { epoch: v.epoch, lastAt: v.lastAt } : null;
    } catch {
      return null;
    }
  }

  private writeStored(lastAt: number) {
    try {
      localStorage.setItem(storeKey(this.eventId), JSON.stringify({ epoch: this.control.epoch, lastAt }));
    } catch {
      // ignore
    }
  }

  stats(): DebugStats {
    return {
      fps: this.fps,
      'drawn fps': this.drawFps,
      attendees: this.order.length,
      visible: this.visibleCount,
      queue: this.queue.queue.length,
      phase: this.queue.phase,
      tier: `${this.layout.tier} (${this.layout.cols}×${this.layout.rows}, ${this.layout.size}px)`,
      images: this.cache.size,
      mode: `${this.control.mode}${this.control.welcomePaused ? ' (paused)' : ''} · final ${this.final.state}`,
      epoch: this.control.epoch,
      stage: `${W}×${H} @${Math.min(2, window.devicePixelRatio || 1)}x`,
      synced: this.initialised ? 'yes' : 'waiting for server',
    };
  }
}
