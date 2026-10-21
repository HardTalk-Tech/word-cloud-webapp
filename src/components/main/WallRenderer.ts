// Photo wall drawing: logo header, faint crown watermark, decorative rings, round photo tiles on a
// fixed 5 × 5 grid with pop / land / glow / exit, new-arrival rings, name tags and the light sweep. Everything with
// gradients or clips is pre-rendered into sprites, so a frame is mostly drawImage calls.
import { BRAND } from '@/config/brand';
import { RING_PATTERN, STAGE } from '@/config/stage';
import { WALL } from '@/config/timings';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, progress, type Rect } from '@/lib/anim';
import type { FontFamilies } from '@/lib/fonts';
import { HEADER_H, WALL_AREA, gridBox, gridSlot } from '@/lib/wall/slots';
import {
  clearStage,
  drawLogo,
  ellipsize,
  fitFontSize,
  glowSprite,
  roundRectPath,
  type BrandImages,
} from '@/components/stage/canvas';

export { HEADER_H, WALL_AREA };

/** Sprite resolution limits for round tiles, and the red rim as a share of the diameter. */
const SPRITE_MIN = 96;
const SPRITE_MAX = 320;
const GLASS = 160;
const RIM = 0.035;
const TAU = Math.PI * 2;

export type TileState = {
  /** Grid spot (0–24, reading order). Never changes while the person is on the wall. */
  slot: number;
  /** When the tile became visible on the wall, and how. */
  appearAt: number;
  appear: 'none' | 'pop' | 'land';
  /** Left the wall: replaced by a new arrival ('exit') or hidden / deleted ('hide'). */
  leaveAt: number | null;
  leave: 'exit' | 'hide';
};

export function leaveMs(t: TileState): number {
  return t.leave === 'exit' ? WALL.exitMs : WALL.hideFadeMs;
}

export function tileRect(t: TileState): Rect {
  return gridSlot(t.slot, WALL_AREA);
}

/** Scale + alpha for appear / leave animations. */
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
  if (t.leaveAt !== null) {
    const p = progress(now, t.leaveAt, leaveMs(t));
    alpha *= 1 - p;
    scale *= 1 - (t.leave === 'exit' ? 0.55 : 0.3) * p;
  }
  return { scale, alpha };
}

function spriteCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Round photo with a thin red rim (lighter at the top, like lit glass). */
function makeTileSprite(img: HTMLImageElement): HTMLCanvasElement {
  const size = clamp(Math.round(img.naturalWidth), SPRITE_MIN, SPRITE_MAX);
  const [c, ctx] = spriteCanvas(size);
  const r = size / 2;
  const rim = size * RIM;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, TAU);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#E2475A');
  g.addColorStop(1, '#7A1622');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r - rim, 0, TAU);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  // Cover-fit (photos are square, but be safe).
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, rim, rim, size - rim * 2, size - rim * 2);
  // Soft highlight on the top edge.
  const hl = ctx.createLinearGradient(0, 0, 0, size * 0.4);
  hl.addColorStop(0, 'rgba(255,255,255,0.14)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, size, size * 0.4);
  ctx.restore();
  return c;
}

/** Empty slot: dim red glass circle. */
function makeGlassSprite(): HTMLCanvasElement {
  const [c, ctx] = spriteCanvas(GLASS);
  const r = GLASS / 2;
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, TAU);
  const g = ctx.createLinearGradient(0, 0, GLASS, GLASS);
  g.addColorStop(0, 'rgba(120,22,36,0.42)');
  g.addColorStop(1, 'rgba(40,8,14,0.42)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = GLASS * 0.025;
  ctx.strokeStyle = 'rgba(214,60,78,0.34)';
  ctx.stroke();
  ctx.save();
  ctx.clip();
  const hl = ctx.createLinearGradient(0, 0, 0, GLASS * 0.45);
  hl.addColorStop(0, 'rgba(255,255,255,0.10)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, 0, GLASS, GLASS * 0.45);
  ctx.restore();
  return c;
}

/** Glowing red circle outline for highlighted tiles (drawn larger than the tile). */
function makeRingSprite(): HTMLCanvasElement {
  const size = 160;
  const [c, ctx] = spriteCanvas(size);
  for (const [width, alpha] of [
    [18, 0.12],
    [11, 0.25],
    [5, 0.95],
  ] as const) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 20, 0, TAU);
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
  readonly spark = glowSprite('#FFD9DD', 48);
  readonly sweep = makeSweepSprite();
  private tiles = new WeakMap<object, HTMLCanvasElement>();

  /** Round tile sprite for a decoded image (created once per image). */
  tile(img: HTMLImageElement | null): HTMLCanvasElement | null {
    if (!img) return null;
    let s = this.tiles.get(img);
    if (!s) {
      s = makeTileSprite(img);
      this.tiles.set(img, s);
    }
    return s;
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

/** Header band: the stacked George Steuart Health logo, centred. */
export function drawHeader(ctx: CanvasRenderingContext2D, fonts: FontFamilies, brand: BrandImages, alpha = 1) {
  drawLogo(ctx, { x: STAGE.width / 2, y: HEADER_H / 2 + 8, height: Math.round(HEADER_H * 0.86), fonts, brand, alpha });
}

/**
 * Background pattern: concentric rings centred on the grid (the outer ones run past it), each with a
 * couple of light pulses travelling round. Only the pattern moves; the photos stay put.
 */
export function drawRingPattern(ctx: CanvasRenderingContext2D, sprites: WallSprites, now: number, alpha: number) {
  if (alpha <= 0) return;
  const box = gridBox(WALL_AREA);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const half = box.w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, WALL_AREA.y - 8, STAGE.width, STAGE.height - WALL_AREA.y + 8);
  ctx.clip();
  RING_PATTERN.radii.forEach((k, i) => {
    ctx.globalAlpha = (i % 2 ? 0.16 : 0.24) * alpha;
    ctx.lineWidth = i % 2 ? 1.5 : 2.5;
    ctx.strokeStyle = BRAND.red;
    ctx.beginPath();
    ctx.arc(cx, cy, half * k, 0, TAU);
    ctx.stroke();
  });
  ctx.globalCompositeOperation = 'lighter';
  RING_PATTERN.radii.forEach((k, ring) => {
    const r = half * k;
    const dir = ring % 2 ? -1 : 1;
    // Same speed along every ring, so the outer pulses take longer to go round.
    const speed = (TAU / WALL.orbitPulseMs) * (RING_PATTERN.radii[0] / k);
    for (let i = 0; i < 2; i++) {
      const a = dir * now * speed + i * Math.PI + ring * 1.3;
      // Short comet: a bright head and a fading tail.
      for (let j = 0; j < 6; j++) {
        const ta = a - dir * j * (0.035 / k);
        const size = 30 - j * 4;
        ctx.globalAlpha = alpha * 0.75 * (1 - j / 6);
        ctx.drawImage(sprites.spark, cx + Math.cos(ta) * r - size / 2, cy + Math.sin(ta) * r - size / 2, size, size);
      }
      ctx.globalAlpha = alpha * 0.45;
      ctx.drawImage(sprites.glow, cx + Math.cos(a) * r - 28, cy + Math.sin(a) * r - 28, 56, 56);
    }
  });
  ctx.restore();
}

/** One tile. `sprite` null (photo still loading / empty slot) → a glass circle. */
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

/** A circle being replaced: a few sparks fly outward from it. p = 0..1 over the exit. */
export function drawExitSparks(ctx: CanvasRenderingContext2D, sprites: WallSprites, r: Rect, p: number, seed: number) {
  if (p <= 0 || p >= 1) return;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dist = r.w * (0.3 + 0.9 * easeOutCubic(p));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (1 - p) ** 1.2;
  for (let i = 0; i < 8; i++) {
    const a = seed + (i / 8) * TAU;
    const d = dist * (0.7 + 0.3 * ((i * 7) % 3));
    const size = 26 * (1 - p * 0.6);
    ctx.drawImage(sprites.spark, cx + Math.cos(a) * d - size / 2, cy + Math.sin(a) * d - size / 2, size, size);
  }
  ctx.restore();
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
  const scale = 1 + 0.08 * k;
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

/** Name on a dark pill across the bottom of a circle. `detail` (department) adds a smaller second line. */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  fonts: FontFamilies,
  r: Rect,
  name: string,
  detail: string,
  alpha: number,
) {
  if (alpha <= 0.01 || !name) return;
  const maxW = r.w * 0.92;
  const nameMax = Math.round(r.w * (detail ? 0.1 : 0.13));
  const nameFont = (s: number) => `800 ${s}px ${fonts.display}`;
  const nameSize = fitFontSize(ctx, name, nameFont, maxW - 24, nameMax, 14);
  const detailSize = detail ? Math.max(12, Math.round(nameSize * 0.62)) : 0;
  const padY = nameSize * 0.32;
  const h = nameSize + padY * 2 + (detail ? detailSize * 1.15 : 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = nameFont(nameSize);
  const label = ellipsize(ctx, name, maxW - 24);
  let w = ctx.measureText(label).width + nameSize * 1.1;
  let detailLabel = '';
  if (detail) {
    ctx.font = `600 ${detailSize}px ${fonts.display}`;
    detailLabel = ellipsize(ctx, detail, maxW - 24);
    w = Math.max(w, ctx.measureText(detailLabel).width + nameSize * 1.1);
  }
  w = Math.min(maxW, w);
  const cx = r.x + r.w / 2;
  const top = r.y + r.h - h * 0.8;
  roundRectPath(ctx, cx - w / 2, top, w, h, h / 2);
  ctx.fillStyle = 'rgba(14,8,10,0.82)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(214,60,78,0.7)';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = BRAND.white;
  ctx.font = nameFont(nameSize);
  ctx.fillText(label, cx, top + padY + nameSize / 2);
  if (detailLabel) {
    ctx.font = `600 ${detailSize}px ${fonts.display}`;
    ctx.fillStyle = '#FF9AA6';
    ctx.fillText(detailLabel, cx, top + padY + nameSize + detailSize * 0.62);
  }
  ctx.restore();
}

/**
 * Diagonal shine crossing the wall. 'source-atop' keeps it on the tiles and glass circles only.
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
