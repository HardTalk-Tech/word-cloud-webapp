// Screen 1 engine: data → queue → one rAF loop drawing the photo wall, spotlight and final mosaic.
// The wall shows only the newest 25 attendees on a fixed 5 × 5 grid; everyone is kept for the final crown.
import { BRAND } from '@/config/brand';
import { STAGE } from '@/config/stage';
import { SPOTLIGHT, WALL } from '@/config/timings';
import { progress, type Rect } from '@/lib/anim';
import { ensureFonts, fontFamilies, type FontFamilies } from '@/lib/fonts';
import { ImageCache } from '@/lib/images/cache';
import { containRect, loadMask } from '@/lib/mask/mask';
import { catchUpIds, enqueue, initialQueue, removeId, tick, type QueueState } from '@/lib/wall/queue';
import { assignSlots, gridCapacity, gridSlot, wallWindow } from '@/lib/wall/slots';
import { DEFAULT_CONTROL, type Attendee, type ControlState, type WallAttendee } from '@/types/models';
import type { ScreenTheme } from '@/config/themes';
import {
  NO_BRAND_IMAGES,
  decorCrown,
  drawWordmark,
  loadBrandImages,
  setupCanvas,
  type BrandImages,
} from '@/components/stage/canvas';
import { setBackgroundPaused } from '@/components/stage/BackgroundRenderer';
import type { DebugStats } from '@/components/stage/DebugOverlay';
import { FinalMosaic } from './FinalMosaic';
import { SpotlightRenderer, type SpotPerson } from './SpotlightRenderer';
import {
  WALL_AREA,
  WallSprites,
  drawBackground,
  drawExitSparks,
  drawGlowTile,
  drawHeader,
  drawLandGlow,
  drawNameTag,
  drawRing,
  drawRingPattern,
  drawSweep,
  drawTile,
  drawWatermark,
  leaveMs,
  tileFx,
  tileRect,
  type TileState,
} from './WallRenderer';

const W = STAGE.width;
const H = STAGE.height;
const CAPACITY = gridCapacity();
/** Crown area for the final mosaic; the wordmark sits below it. */
const FINAL_BOX: Rect = { x: W * 0.05, y: H * 0.04, w: W * 0.9, h: H * 0.76 };
const FINAL_WORDMARK_Y = H * 0.9;
const FINAL_WORDMARK_W = W * 0.62;

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

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

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
  private shownWhilePaused = new Set<string>();

  /** Who is on the wall → their grid spot. Spots never change while someone is on the wall. */
  private slots = new Map<string, number>();
  /** null until the first window is placed (an empty wall is a window too). */
  private windowKey: string | null = null;
  /** The first window after load is history: placed without animation. */
  private windowPrimed = false;
  /** Tiles on the wall, plus ones still animating off it. */
  private tiles = new Map<string, TileState>();

  private brand: BrandImages = NO_BRAND_IMAGES;
  private watermarkRect: Rect | null = null;
  /** Where the crown sits in final mode: the faint crown is drawn here behind the photo mosaic. */
  private finalCrownRect: Rect | null = null;

  private readonly sprites: WallSprites;
  /** Faint crown for the watermark / finale, in the theme's colour. */
  private crownDecor: CanvasImageSource | null = null;
  /** New arrivals → when they appeared (soft red ring fading over WALL.newArrivalMs). */
  private recent = new Map<string, number>();
  private sweepAt = -Infinity;
  private nextSweepAt = 0;

  private ambient: { id: string; start: number } | null = null;
  private nextAmbientAt = 0;
  private dirty = true;
  private lastDrawAt = 0;
  private visibleIdsKey = '';

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
    private readonly theme: ScreenTheme,
  ) {
    this.sprites = new WallSprites(theme);
    this.ctx = setupCanvas(canvas, W, H, { transparent: true });
    this.fonts = fontFamilies();
    this.cache = new ImageCache(12, () => {
      this.dirty = true;
    });
    this.spot = new SpotlightRenderer(this.fonts, confettiCanvas, theme);
    this.nextSweepAt = performance.now() + WALL.sweepEveryMinMs;
  }

  async init() {
    const [brand] = await Promise.all([loadBrandImages(), ensureFonts(this.fonts)]);
    if (this.destroyed) return;
    this.brand = brand;
    this.crownDecor = decorCrown(brand.crown, this.theme.crownTint);
    if (brand.crown) {
      // Watermark: the real crown, centred behind the rings.
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
      // Reloaded in final mode: lay the mosaic out again now that the crown is known.
      this.visibleIdsKey = '';
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
    setBackgroundPaused(false);
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
    const next = list.map(toWall).filter((a): a is WallAttendee => a !== null && !this.stale.has(a.id));
    const ids = new Set(next.map((a) => a.id));
    for (const id of this.attendees.keys()) {
      if (!ids.has(id)) this.queue = removeId(this.queue, id);
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

    // Everyone's small tile (the final crown uses them all); lqip until it decodes.
    for (const a of next) {
      if (a.hidden) continue;
      void this.cache.load(a.lqip);
      void this.cache.load(a.tileUrl);
    }
    this.preloadSpots();
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
    this.slots = new Map();
    this.windowKey = '';
    this.recent.clear();
    this.spot.reset();
    try {
      localStorage.removeItem(storeKey(this.eventId));
    } catch {
      // ignore
    }
  }

  /** Spotlight photos: the next people up, and everyone on the wall (the circles are bigger than a tile). */
  private preloadSpots() {
    const ids = [...this.queue.current, ...this.queue.queue.slice(0, 8), ...this.slots.keys()];
    for (const id of ids) {
      const a = this.attendees.get(id);
      if (a) void this.cache.load(a.spotUrl, true);
    }
  }

  // ── Photo wall ──────────────────────────────────────────────────────

  /** Newest 25 on the wall, including whoever is flying in from the spotlight right now. */
  private computeWindow(): string[] {
    const flying = this.queue.phase === 'SPOT_FLY' ? this.queue.current : [];
    const ids = this.order.filter((id) => {
      const a = this.attendees.get(id);
      if (!a || a.hidden) return false;
      return this.isVisible(a) || flying.includes(id);
    });
    return wallWindow(ids, CAPACITY);
  }

  /** Window changed: newcomers take a free spot (or the oldest person's); nobody else moves. */
  private applyWindow(window: string[], now: number) {
    const key = window.join(',');
    if (key === this.windowKey) return;
    const instant = !this.windowPrimed;
    this.windowPrimed = true;
    this.windowKey = key;
    this.slots = assignSlots(this.slots, window, CAPACITY);

    for (const [id, t] of this.tiles) {
      if (this.slots.has(id) || t.leaveAt !== null) continue;
      if (instant) {
        this.tiles.delete(id);
        continue;
      }
      const a = this.attendees.get(id);
      t.leaveAt = now;
      t.leave = a && !a.hidden ? 'exit' : 'hide';
      this.recent.delete(id);
      if (this.ambient?.id === id) this.ambient = null;
    }

    for (const [id, slot] of this.slots) {
      const t = this.tiles.get(id);
      if (t && t.leaveAt === null) continue;
      // New on the wall. Spotlight arrivals are drawn by the flying card until they land.
      const flying = this.queue.current.includes(id);
      const pop = !instant && !flying;
      this.tiles.set(id, { slot, appearAt: now, appear: pop ? 'pop' : 'none', leaveAt: null, leave: 'exit' });
      if (pop && this.initialised) this.markRecent(id, now);
    }
    this.preloadSpots();
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
        this.markRecent(id, now);
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
    // Before the first server snapshot the wall waits (so history is placed, not animated in).
    if (this.initialised) this.applyWindow(this.computeWindow(), now);
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
    for (const [id, t] of this.tiles) {
      if (t.leaveAt !== null && now - t.leaveAt >= leaveMs(t)) this.tiles.delete(id);
    }

    const idle = this.queue.phase === 'WALL_IDLE';
    // Light sweep every 20–30 s while nothing else is on screen.
    if (idle && now >= this.nextSweepAt && now - this.sweepAt > WALL.sweepMs) {
      this.sweepAt = now;
      this.nextSweepAt = now + WALL.sweepEveryMinMs + Math.random() * (WALL.sweepEveryMaxMs - WALL.sweepEveryMinMs);
    }
    for (const [id, at] of this.recent) if (now - at >= WALL.newArrivalMs) this.recent.delete(id);

    // The spotlight covers the whole screen; the slow background can hold still meanwhile.
    setBackgroundPaused(!idle);

    // Settled final crown: nothing moves. Idle wall with only the slow ring lights moving: idleFps is enough.
    const settledFinal = this.final.state === 'on' && !this.final.isAnimating(now) && idle;
    if (settledFinal && !this.dirty) return;
    const busy = !idle || this.final.isAnimating(now) || this.ambient !== null || now - this.sweepAt < WALL.sweepMs || this.tilesBusy(now);
    if (!busy && !this.dirty && now - this.lastDrawAt < 1000 / WALL.idleFps) return;
    this.draw(now);
    this.lastDrawAt = now;
    this.drawn++;
    this.dirty = false;
  }

  /** A tile is popping in, landing, glowing or leaving. */
  private tilesBusy(now: number): boolean {
    const appearMs = Math.max(WALL.popMs, WALL.landBounceMs, WALL.landGlowMs);
    for (const t of this.tiles.values()) {
      if (t.leaveAt !== null) return true;
      if (t.appear !== 'none' && now - t.appearAt < appearMs) return true;
    }
    return false;
  }

  /** Best decoded image for a wall circle: the spotlight photo once it is in (circles are bigger than a tile). */
  private image(a: WallAttendee): HTMLImageElement | null {
    return this.cache.get(a.spotUrl) ?? this.cache.get(a.tileUrl) ?? this.cache.get(a.lqip) ?? null;
  }

  private draw(now: number) {
    const ctx = this.ctx;
    drawBackground(ctx);
    // Spotlight fully up: its blurred snapshot of the wall covers everything, so skip drawing the wall under it.
    if (this.queue.phase === 'SPOT_HOLD' && !this.final.active) {
      this.drawSpotlight(now);
      return;
    }
    const fin = this.final.amount(now);
    const wallA = 1 - fin;
    drawWatermark(ctx, this.crownDecor, this.watermarkRect, wallA);
    // Final mode: the real crown, faint, behind the photo mosaic so the design reads through it.
    if (fin > 0 && this.crownDecor && this.finalCrownRect) {
      const r = this.finalCrownRect;
      ctx.save();
      ctx.globalAlpha = 0.28 * fin;
      ctx.drawImage(this.crownDecor, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
    drawHeader(ctx, this.fonts, this.brand, wallA);

    const visible = this.final.active ? this.visibleIds() : [];
    if (this.final.active) {
      const key = visible.join(',');
      if (key !== this.visibleIdsKey) {
        this.visibleIdsKey = key;
        this.final.update(visible, now, (id) => {
          const t = this.tiles.get(id);
          return t ? tileRect(t) : null;
        });
      }
    }

    // Ring pattern + empty spots as dim glass circles (the wall looks complete from the first minute).
    drawRingPattern(ctx, this.sprites, now, wallA);
    if (wallA > 0) {
      const taken = new Set(this.slots.values());
      for (let slot = 0; slot < CAPACITY; slot++) {
        if (!taken.has(slot)) drawTile(ctx, null, this.sprites, gridSlot(slot, WALL_AREA), 1, wallA);
      }
    }

    // Pass 1: where each tile is this frame. Spotlit people are drawn by the spotlight card instead.
    const drawList: { id: string; t: TileState; rect: Rect; sprite: HTMLCanvasElement | null }[] = [];
    for (const [id, t] of this.tiles) {
      const a = this.attendees.get(id);
      if (!a || this.queue.current.includes(id)) continue;
      const wallR = tileRect(t);
      const rect = t.leaveAt === null ? (this.final.rect(id, wallR, now) ?? wallR) : wallR;
      drawList.push({ id, t, rect, sprite: this.sprites.tile(this.image(a)) });
    }
    // Final mode: everyone not on the wall grows out of their crown cell.
    for (const id of visible) {
      if (this.tiles.has(id)) continue;
      const cell = this.final.cell(id);
      const a = this.attendees.get(id);
      if (!cell || !a) continue;
      const point = { x: cell.x + cell.w / 2, y: cell.y + cell.h / 2, w: 0, h: 0 };
      const rect = this.final.rect(id, point, now) ?? point;
      if (rect.w < 1) continue;
      const img = this.cache.get(a.tileUrl) ?? this.cache.get(a.lqip) ?? null;
      drawList.push({
        id,
        t: { slot: CAPACITY, appearAt: -Infinity, appear: 'none', leaveAt: null, leave: 'exit' },
        rect,
        sprite: this.sprites.tile(img),
      });
    }

    // Pass 2: red flash where a photo just landed / popped in (under the tile).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of drawList) {
      if (d.t.appear !== 'none' && now - d.t.appearAt < WALL.landGlowMs) {
        drawLandGlow(ctx, this.sprites, d.rect, (now - d.t.appearAt) / WALL.landGlowMs);
      }
    }
    ctx.restore();

    // Pass 3: round photo tiles; someone being replaced bursts into sparks.
    for (const d of drawList) {
      if (this.ambient?.id === d.id) continue;
      const fx = tileFx(d.t, now);
      drawTile(ctx, d.sprite, this.sprites, d.rect, fx.scale, fx.alpha);
      if (d.t.leave === 'exit' && d.t.leaveAt !== null) {
        drawExitSparks(ctx, this.sprites, d.rect, progress(now, d.t.leaveAt, WALL.exitMs), d.t.leaveAt % 6.28);
      }
    }

    // Pass 4: soft red ring on the newest arrivals, fading out.
    if (this.recent.size && fin < 1) {
      ctx.save();
      for (const d of drawList) {
        const at = this.recent.get(d.id);
        if (at === undefined || d.t.leaveAt !== null) continue;
        const p = (now - at) / WALL.newArrivalMs;
        drawRing(ctx, this.sprites, d.rect, (1 - p) ** 1.5 * wallA * tileFx(d.t, now).alpha);
      }
      ctx.restore();
    }

    // Ambient glow on one random circle.
    if (!this.final.active && this.queue.phase === 'WALL_IDLE') {
      const settled = drawList.filter((d) => d.t.leaveAt === null && d.t.slot < CAPACITY);
      if (!this.ambient && now >= this.nextAmbientAt && settled.length) {
        this.ambient = { id: settled[Math.floor(Math.random() * settled.length)].id, start: now };
      }
      if (this.ambient) {
        const p = progress(now, this.ambient.start, WALL.ambientDurationMs);
        const d = drawList.find((x) => x.id === this.ambient?.id);
        if (d) drawGlowTile(ctx, d.sprite, this.sprites, d.rect, p);
        if (p >= 1 || !d) {
          this.ambient = null;
          this.nextAmbientAt =
            now + WALL.ambientEveryMinMs + Math.random() * (WALL.ambientEveryMaxMs - WALL.ambientEveryMinMs);
        }
      }
    } else if (this.ambient) {
      this.ambient = null;
    }

    // Name + department badge on every circle.
    if (wallA > 0) {
      for (const d of drawList) {
        if (d.t.leaveAt !== null || d.t.slot >= CAPACITY) continue;
        const a = this.attendees.get(d.id);
        if (!a) continue;
        drawNameTag(ctx, this.sprites, this.fonts, d.rect, firstName(a.name), a.department, wallA * tileFx(d.t, now).alpha);
      }
    }

    // Diagonal shine across the photos and glass circles.
    if (this.queue.phase === 'WALL_IDLE') drawSweep(ctx, this.sprites, (now - this.sweepAt) / WALL.sweepMs);

    if (fin > 0) {
      drawWordmark(ctx, {
        x: W / 2,
        y: FINAL_WORDMARK_Y,
        // Wordmark only: the photo mosaic is the crown.
        width: FINAL_WORDMARK_W * (0.96 + 0.04 * fin),
        height: 70,
        align: 'center',
        fonts: this.fonts,
        brand: this.brand,
        crown: false,
        alpha: fin,
      });
    }

    this.drawSpotlight(now);
  }

  private drawSpotlight(now: number) {
    if (this.queue.phase !== 'WALL_IDLE') {
      const q = this.queue;
      const dur = q.phase === 'SPOT_IN' ? SPOTLIGHT.inMs : q.phase === 'SPOT_HOLD' ? q.holdMs : SPOTLIGHT.flyMs;
      const people: SpotPerson[] = q.current.map((id) => {
        const a = this.attendees.get(id);
        const t = this.tiles.get(id);
        const img = a ? (this.cache.get(a.spotUrl) ?? this.cache.get(a.tileUrl) ?? this.cache.get(a.lqip) ?? null) : null;
        return { id, name: a?.name ?? '', department: a?.department ?? '', img, target: t ? tileRect(t) : null };
      });
      this.spot.draw(this.ctx, q.phase, progress(now, q.phaseStartedAt, dur), people);
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
      'on wall': `${this.slots.size}/${CAPACITY}`,
      queue: this.queue.queue.length,
      phase: this.queue.phase,
      images: this.cache.size,
      mode: `${this.control.mode}${this.control.welcomePaused ? ' (paused)' : ''} · final ${this.final.state}`,
      epoch: this.control.epoch,
      stage: `${W}×${H} @${(this.ctx.canvas.width / W).toFixed(2)}x`,
      synced: this.initialised ? 'yes' : 'waiting for server',
    };
  }
}
