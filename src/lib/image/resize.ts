// Browser-side image pipeline: crop → spot (800px) + tile (128px) JPEGs + 16px lqip data URL.

export const SPOT_SIZE = 800;
export const TILE_SIZE = 128;
export const LQIP_SIZE = 16;
export const SPOT_MAX_BYTES = 250 * 1024;

export type CropRect = { x: number; y: number; width: number; height: number };

export type ProcessedImages = {
  spot: Blob;
  tile: Blob;
  lqip: string;
};

/** Clamp a crop to the image bounds and force it square (pure, unit tested). */
export function normaliseCrop(crop: CropRect, imageW: number, imageH: number): CropRect {
  const maxSide = Math.min(imageW, imageH);
  const side = Math.max(1, Math.min(Math.round(Math.min(crop.width, crop.height)), maxSide));
  const x = Math.min(Math.max(0, Math.round(crop.x)), imageW - side);
  const y = Math.min(Math.max(0, Math.round(crop.y)), imageH - side);
  return { x, y, width: side, height: side };
}

/** Halving step-down sizes from `from` to `to` (e.g. 800 → 400 → 200 → 128). */
export function stepDownSizes(from: number, to: number): number[] {
  const sizes: number[] = [];
  let s = from;
  while (s / 2 > to) {
    s = Math.round(s / 2);
    sizes.push(s);
  }
  sizes.push(to);
  return sizes;
}

/** Share of the spare height kept above the crop on portrait photos (0.5 = centred). */
export const PORTRAIT_TOP_BIAS = 0.35;

/**
 * Automatic square crop: centred horizontally; on portrait photos slightly above centre,
 * because faces in selfies sit in the upper half. CSS preview uses the same numbers.
 */
export function centreCrop(imageW: number, imageH: number): CropRect {
  const side = Math.min(imageW, imageH);
  const yBias = imageH > imageW ? PORTRAIT_TOP_BIAS : 0.5;
  return { x: (imageW - side) / 2, y: (imageH - side) * yBias, width: side, height: side };
}

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function toBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality);
  });
}

function release(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older Safari: fall back to <img>, which applies EXIF orientation itself.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function processImage(file: Blob, crop: CropRect | null = null): Promise<ProcessedImages> {
  const source = await decode(file);
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const rect = normaliseCrop(crop ?? centreCrop(w, h), w, h);

  const spotCanvas = makeCanvas(SPOT_SIZE);
  const spotCtx = ctx2d(spotCanvas);
  spotCtx.fillStyle = '#000';
  spotCtx.fillRect(0, 0, SPOT_SIZE, SPOT_SIZE);
  spotCtx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, SPOT_SIZE, SPOT_SIZE);
  if ('close' in source) source.close();

  let spot = await toBlob(spotCanvas, 0.82);
  if (spot.size > SPOT_MAX_BYTES) spot = await toBlob(spotCanvas, 0.72);

  // Step down for a sharper tile than a single 800 → 128 jump.
  let prev: HTMLCanvasElement = spotCanvas;
  for (const size of stepDownSizes(SPOT_SIZE, TILE_SIZE)) {
    const next = makeCanvas(size);
    ctx2d(next).drawImage(prev, 0, 0, size, size);
    if (prev !== spotCanvas) release(prev);
    prev = next;
  }
  const tileCanvas = prev;
  const tile = await toBlob(tileCanvas, 0.8);

  const lqipCanvas = makeCanvas(LQIP_SIZE);
  ctx2d(lqipCanvas).drawImage(tileCanvas, 0, 0, LQIP_SIZE, LQIP_SIZE);
  const lqip = lqipCanvas.toDataURL('image/jpeg', 0.5);

  release(spotCanvas);
  release(tileCanvas);
  release(lqipCanvas);
  return { spot, tile, lqip };
}
