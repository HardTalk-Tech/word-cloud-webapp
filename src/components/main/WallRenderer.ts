// Photo wall drawing: header band, faint crown watermark, glass cells, rounded tiles with
// pop / land / glow, new-arrival rings and the light sweep. Everything with gradients or
// rounded clips is pre-rendered into sprites, so a frame is just drawImage calls.
import { MAX_DPR, STAGE, WALL_HEADER_RATIO, WALL_PADDING } from '@/config/stage';
import { WALL } from '@/config/timings';
import { clamp, easeInOutCubic, easeOutBack, lerpRect, progress, type Rect } from '@/lib/anim';
import type { FontFamilies } from '@/lib/fonts';
import {
  clearStage,
  drawEventTitle,
  drawWordmark,
  glowSprite,
  roundRectPath,
  type BrandImages,
} from '@/components/stage/canvas';

export const HEADER_H = Math.round(STAGE.height * WALL_HEADER_RATIO);

export const WALL_AREA: Rect = {
  x: WALL_PADDING,
  y: HEADER_H + WALL_PADDING / 2,
  w: STAGE.width - WALL_PADDING * 2,
  h: STAGE.height - HEADER_H - WALL_PADDING * 1.5,
};

/** Sprite resolution for tiles / glass cells, and the corner radius + red rim as a share of it. */
const SPRITE = 120;
const RADIUS = 0.16;
const RIM = 0.045;

export type TileState = {
  from: Rect;
  to: Rect;
  moveStart: number;
  moveMs: number;
  /** When the tile became visible on the wall, and how. */
  appearAt: number;
  appear: 'none' | 'pop' | 'land';
  /** Fade-out start when hidden; null while visible. */
  hideAt: number | null;
};

export function tileRect(t: TileState, now: number): Rect {
  const p = progress(now, t.moveStart, t.moveMs);
  return p >= 1 ? t.to : lerpRect(t.from, t.to, easeInOutCubic(p));
}

export function isTileAnimating(t: TileState, now: number): boolean {
  if (now - t.moveStart < t.moveMs) return true;
  if (t.appear !== 'none' && now - t.appearAt < WALL.landGlowMs) return true;
  if (t.appear === 'pop' && now - t.appearAt < WALL.popMs) return true;
  if (t.appear === 'land' && now - t.appearAt < WALL.landBounceMs) return true;
  if (t.hideAt !== null && now - t.hideAt < WALL.hideFadeMs) return true;
  return false;
}

/** Scale + alpha for appear / hide animations. */
export function tileFx(t: TileState, now: number): { scale: number; alpha: number } {
  let scale = 1;
  let alpha = 1;
  if (t.appear === 'pop') {
    const p = progress(now, t.appearAt, WALL.popMs);
    scale = p >= 1 ? 1 : Math.max(0, easeOutBack(p));
    alpha = clamp(p * 2, 0, 1);
  } else if (t.appear === 'land') {
    const p = progress(now, t.appearAt, WALL.landBounceMs);
    scale = 1 + 0.14 * Math.sin(Math.PI * p) * (1 - p);
  }
  if (t.hideAt !== null) {
    const p = progress(now, t.hideAt, WALL.hideFadeMs);
    alpha *= 1 - p;
    scale *= 1 - 0.3 * p;
  }
  return { scale, alpha };
}

function spriteCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Rounded photo with a thin red rim (lighter at the top, like lit glass). */
function makeTileSprite(img: CanvasImageSource): HTMLCanvasElement {
  const [c, ctx] = spriteCanvas(SPRITE);
  const r = SPRITE * RADIUS;
  const rim = SPRITE * RIM;
  roundRectPath(ctx, 0, 0, SPRITE, SPRITE, r);
  const g = ctx.createLinearGradient(0, 0, 0, SPRITE);
  g.addColorStop(0, '#E2475A');
  g.addColorStop(1, '#7A1622');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, rim, rim, SPRITE - rim * 2, SPRITE - rim * 2, r - rim * 0.7);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, rim, rim, SPRITE - rim * 2, SPRITE - rim * 2);
  ctx.restore();
  return c;
}

/** Empty slot: dim red glass cell. */
function makeGlassSprite(): HTMLCanvasElement {
  const [c, ctx] = spriteCanvas(SPRITE);
  const r = SPRITE * RADIUS;
  roundRectPath(ctx, 2, 2, SPRITE - 4, SPRITE - 4, r);
  const g = ctx.createLinearGradient(0, 0, SPRITE, SPRITE);
  g.addColorStop(0, 'rgba(120,22,36,0.42)');
  g.addColorStop(1, 'rgba(40,8,14,0.42)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = SPRITE * 0.03;
  ctx.strokeStyle = 'rgba(214,60,78,0.32)';
  ctx.stroke();
  // Soft highlight on the top edge.
  ctx.save();
  ctx.clip();
  const hl = ctx.createLinearGradient(0, 0, 0, SPRITE * 0.45);
  hl.addColorStop(0, 'rgba(255,255,255,0.10)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, SPRITE, SPRITE * 0.45);
  ctx.restore();
  return c;
}

/** Glowing red outline for highlighted tiles (drawn larger than the tile). */
function makeRingSprite(): HTMLCanvasElement {
  const size = 160;
  const [c, ctx] = spriteCanvas(size);
  const inset = 20;
  const r = (size - inset * 2) * RADIUS + 6;
  for (const [width, alpha] of [
    [18, 0.12],
    [11, 0.25],
    [5, 0.95],
  ] as const) {
    roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
    ctx.lineWidth = width;
    ctx.strokeStyle = `rgba(232,62,80,${alpha})`;
    ctx.stroke();
  }
  return c;
}

/** Soft diagonal band of light for the sweep. */
function makeSweepSprite(): HTMLCanvasElement {
  const [c, ctx] = spriteCanvas(260, 8);
  const g = ctx.createLinearGradient(0, 0, 260, 0);
  g.addColorStop(0, 'rgba(255,230,234,0)');
  g.addColorStop(0.5, 'rgba(255,230,234,0.55)');
  g.addColorStop(1, 'rgba(255,230,234,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 260, 8);
  return c;
}

/** Holds the pre-rendered wall sprites. */
export class WallSprites {
  readonly glass = makeGlassSprite();
  readonly ring = makeRingSprite();
  readonly glow = glowSprite('rgba(232,52,72,1)', 96);
  readonly sweep = makeSweepSprite();
  private tiles = new WeakMap<object, HTMLCanvasElement>();

  /** Rounded tile sprite for a decoded image (created once per image). */
  tile(img: HTMLImageElement | null): HTMLCanvasElement | null {
    if (!img) return null;
    let s = this.tiles.get(img);
    if (!s) {
      s = makeTileSprite(img);
      this.tiles.set(img, s);
    }
    return s;
  }

  /** All slots as glass cells on one stage-size canvas (rebuilt only when the grid changes). */
  glassLayer(slots: Rect[]): HTMLCanvasElement {
    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const [c, ctx] = spriteCanvas(Math.round(STAGE.width * dpr), Math.round(STAGE.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of slots) ctx.drawImage(this.glass, s.x, s.y, s.w, s.h);
    return c;
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D) {
  clearStage(ctx, STAGE.width, STAGE.height);
}

/** Faint George Steuart crown behind the wall. */
export function drawWatermark(ctx: CanvasRenderingContext2D, watermark: CanvasImageSource | null, rect: Rect | null, alpha = 1) {
  if (!watermark || !rect || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = WALL.watermarkOpacity * alpha;
  ctx.drawImage(watermark, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Header band: crown + "George Steuart / HEALTH" on the left, event title on the right. */
export function drawHeader(ctx: CanvasRenderingContext2D, fonts: FontFamilies, brand: BrandImages, alpha = 1) {
  if (alpha <= 0) return;
  const cy = HEADER_H / 2 + 6;
  drawWordmark(ctx, {
    x: WALL_PADDING,
    y: cy,
    height: Math.round(HEADER_H * 0.72),
    align: 'left',
    fonts,
    brand,
    alpha,
  });
  drawEventTitle(ctx, { x: STAGE.width - WALL_PADDING, y: cy, size: Math.round(HEADER_H * 0.3), align: 'right', fonts, alpha });
}

export function drawGlassLayer(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement | null, alpha: number) {
  if (!layer || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer, 0, 0, STAGE.width, STAGE.height);
  ctx.restore();
}

/** One tile. `sprite` null (photo still loading) → a glass cell. */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  sprites: WallSprites,
  r: Rect,
  scale: number,
  alpha: number,
) {
  if (alpha <= 0 || scale <= 0) return;
  const plain = scale === 1 && alpha === 1;
  if (!plain) {
    ctx.save();
    ctx.globalAlpha = alpha;
  }
  const w = r.w * scale;
  const h = r.h * scale;
  ctx.drawImage(sprite ?? sprites.glass, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
  if (!plain) ctx.restore();
}

/** Red flash in the slot as a photo lands (drawn under the tile). p = 0..1. */
export function drawLandGlow(ctx: CanvasRenderingContext2D, sprites: WallSprites, r: Rect, p: number) {
  if (p >= 1) return;
  const size = Math.max(r.w, 24) * (1.6 + 0.8 * p);
  ctx.globalAlpha = 0.9 * (1 - p) ** 1.5;
  ctx.drawImage(sprites.glow, r.x + r.w / 2 - size / 2, r.y + r.h / 2 - size / 2, size, size);
}

/** Glowing ring around a tile (new arrivals, ambient highlight). */
export function drawRing(ctx: CanvasRenderingContext2D, sprites: WallSprites, r: Rect, alpha: number) {
  if (alpha <= 0.01) return;
  // The ring sprite's outline sits 20/160 inside its edge; scale so it hugs the tile.
  const size = r.w * (160 / 120) + 4;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprites.ring, r.x + r.w / 2 - size / 2, r.y + r.h / 2 - size / 2, size, size);
}

/** Ambient highlight: tile grows a little with a glowing ring. p = 0..1 over the glow. */
export function drawGlowTile(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource | null,
  sprites: WallSprites,
  r: Rect,
  p: number,
) {
  const k = Math.sin(Math.PI * clamp(p, 0, 1));
  const scale = 1 + 0.3 * k;
  const w = r.w * scale;
  const grown = { x: r.x + (r.w - w) / 2, y: r.y + (r.w - w) / 2, w, h: w };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawLandGlow(ctx, sprites, grown, 1 - k * 0.6);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (sprite) ctx.drawImage(sprite, grown.x, grown.y, w, w);
  drawRing(ctx, sprites, grown, k);
  ctx.restore();
}

/**
 * Diagonal shine crossing the wall. 'source-atop' keeps it on the tiles and glass cells only.
 * p = 0..1 across the sweep.
 */
export function drawSweep(ctx: CanvasRenderingContext2D, sprites: WallSprites, p: number) {
  if (p <= 0 || p >= 1) return;
  const band = 420;
  const diag = STAGE.width + STAGE.height;
  const x = -band + (diag + band * 2) * easeInOutCubic(p) - STAGE.height * 0.4;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.5 * Math.sin(Math.PI * p);
  ctx.translate(x, STAGE.height / 2);
  ctx.rotate((25 * Math.PI) / 180);
  ctx.drawImage(sprites.sweep, -band / 2, -diag, band, diag * 2);
  ctx.restore();
}
