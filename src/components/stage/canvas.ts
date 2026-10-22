import { MAX_DPR } from '@/config/stage';
import { BACKGROUND } from '@/config/background';
import { BRAND } from '@/config/brand';
import type { FontFamilies } from '@/lib/fonts';

/**
 * Backing-store scale for a `w`×`h` stage: the device pixels it really covers when scaled to fit the screen
 * (screen size, not window size, so going full screen after load stays sharp), never below 1, capped.
 */
export function stagePixelRatio(w: number, h: number): number {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.screen.width / w, window.screen.height / h) || 1;
  return Math.min(MAX_DPR, Math.max(1, dpr * fit));
}

/**
 * Size a canvas to the stage: CSS size = stage px, backing store = the pixels it covers on screen (capped).
 * `transparent` for screen canvases layered over the animated background.
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  { transparent = false }: { transparent?: boolean } = {},
): CanvasRenderingContext2D {
  const dpr = stagePixelRatio(w, h);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d', { alpha: transparent });
  if (!ctx) throw new Error('Canvas 2D not supported');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** Soft round light sprite (bright core → transparent), drawn with 'lighter' for glows and sparks. */
export function glowSprite(color: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.3, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/**
 * Faint decorative crown for the current theme: the brand crown as is, or a solid tint of it
 * (e.g. blue on the Midnight theme). The header logo always keeps the original brand colours.
 */
export function decorCrown(crown: HTMLImageElement | null, tint: string | null): CanvasImageSource | null {
  if (!crown || !tint) return crown;
  const c = document.createElement('canvas');
  c.width = crown.naturalWidth;
  c.height = crown.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(crown, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Start a screen frame: clear (background canvas shows through) or fill when the background is off. */
export function clearStage(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (BACKGROUND.enabled) {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = BRAND.background;
    ctx.fillRect(0, 0, w, h);
  }
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Largest font size ≤ max whose text fits maxWidth. */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  max: number,
  min: number,
): number {
  ctx.font = font(100);
  const w100 = ctx.measureText(text).width;
  if (w100 <= 0) return max;
  return Math.max(min, Math.min(max, Math.floor((maxWidth / w100) * 100)));
}

export function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Decoded brand images from public/brand (see BRAND in config). null = failed to load. */
export type BrandImages = {
  crown: HTMLImageElement | null;
  wordmark: HTMLImageElement | null;
  /** Stacked logo: crown above "George Steuart / HEALTH". */
  logo: HTMLImageElement | null;
};

export const NO_BRAND_IMAGES: BrandImages = { crown: null, wordmark: null, logo: null };

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

export async function loadBrandImages(): Promise<BrandImages> {
  const [crown, wordmark, logo] = await Promise.all([
    loadImage(BRAND.crown),
    loadImage(BRAND.wordmark),
    loadImage(BRAND.logo),
  ]);
  return { crown, wordmark, logo };
}

/** Draw an image at a given height, keeping its aspect. Returns the drawn width. */
export function drawAtHeight(ctx: CanvasRenderingContext2D, img: HTMLImageElement, left: number, top: number, h: number) {
  const w = (img.naturalWidth / img.naturalHeight) * h;
  ctx.drawImage(img, left, top, w, h);
  return w;
}

/**
 * The George Steuart Health logo as the client supplied it: crown centred above the two-line wordmark.
 * (x, y) = centre of the logo; `height` = full logo height.
 */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  opts: { x: number; y: number; height: number; fonts: FontFamilies; brand: BrandImages; alpha?: number },
) {
  const { x, y, height, fonts, brand, alpha = 1 } = opts;
  if (alpha <= 0) return;
  const logo = brand.logo;
  if (!logo) {
    // Fallback if the image failed to load: wordmark only.
    drawWordmark(ctx, { x, y, height: height * 0.45, align: 'center', fonts, brand, crown: false, alpha });
    return;
  }
  const w = (logo.naturalWidth / logo.naturalHeight) * height;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(logo, x - w / 2, y - height / 2, w, height);
  ctx.restore();
}

/**
 * Logo lock-up: [crown] + "George Steuart / HEALTH" wordmark, in one row.
 * `height` is the crown height (or the wordmark height when `crown` is false).
 * `width` (wordmark only) sizes the wordmark by width instead; its height follows the image.
 * (x, y) is the anchor: left/centre/right edge, vertical centre.
 */
export function drawWordmark(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    height: number;
    align: 'left' | 'center' | 'right';
    fonts: FontFamilies;
    brand: BrandImages;
    crown?: boolean;
    alpha?: number;
    width?: number;
  },
) {
  const { x, y, align, fonts, brand, crown = true, alpha = 1, width } = opts;
  if (alpha <= 0) return;
  const crownImg = crown ? brand.crown : null;
  const height =
    width !== undefined && !crownImg && brand.wordmark
      ? (brand.wordmark.naturalHeight / brand.wordmark.naturalWidth) * width
      : opts.height;
  // Two-line "George Steuart / HEALTH" wordmark: ~70% of the crown height next to it.
  const wordH = crownImg ? height * 0.7 : height;
  const gap = crownImg ? height * 0.22 : 0;
  const crownW = crownImg ? (crownImg.naturalWidth / crownImg.naturalHeight) * height : 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  let wordW: number;
  if (brand.wordmark) {
    wordW = (brand.wordmark.naturalWidth / brand.wordmark.naturalHeight) * wordH;
  } else {
    ctx.font = `600 ${Math.round(wordH)}px ${fonts.serif}`;
    wordW = ctx.measureText(BRAND.name).width;
  }
  const total = crownW + gap + wordW;
  let left = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  if (crownImg) {
    drawAtHeight(ctx, crownImg, left, y - height / 2, height);
    left += crownW + gap;
  }
  if (brand.wordmark) {
    drawAtHeight(ctx, brand.wordmark, left, y - wordH / 2, wordH);
  } else {
    // Fallback if the image failed to load.
    ctx.fillStyle = BRAND.greyLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(BRAND.name, left, y);
  }
  ctx.restore();
}
