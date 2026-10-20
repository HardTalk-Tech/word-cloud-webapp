// Builds the brand images used by the app from the client's logo (public/brand/GS-Logo.png):
//   crown.png       red crown only, transparent (headers, faint crown behind cloud + mosaic)
//   wordmark.png    "George Steuart" only, lightened for dark backgrounds
//   logo-dark.png   crown + lightened wordmark (phone, dashboard)
//   crown-mask.png  solid white crown silhouette (dots joined, holes filled) — the shape the
//                   word cloud and the final photo mosaic fill. Same crop box as crown.png.
// and the app icons in src/app (Next.js file conventions):
//   favicon.ico     16 px solid crown silhouette + 32/48 px crown, brand red on transparent (browser tabs)
//   icon.png        512 px, crown on transparent
//   apple-icon.png  180 px, crown on the dark brand background (iOS needs an opaque icon)
// Usage: npm run brand
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public', 'brand');
const APP_DIR = path.join(process.cwd(), 'src', 'app');
const ICON_BG = { r: 0x0b, g: 0x0b, b: 0x0d, alpha: 1 };
const SOURCE = path.join(DIR, 'GS-Logo.png');
/** Wordmark colour on dark screens (logo grey #64666A is too dark on near-black). */
const WORDMARK_ON_DARK = [0xb3, 0xb5, 0xb8] as const;
/** Silhouette is built at this multiple of the logo resolution for smooth edges. */
const MASK_SCALE = 4;
const PAD = 6;

type Raw = { data: Buffer; width: number; height: number };

// Near-transparent edge pixels carry arbitrary colours; ignore them when classifying.
const MIN_ALPHA = 24;
const isRed = (r: number, g: number, a: number) => a >= MIN_ALPHA && r - g > 50;
const isGrey = (r: number, g: number, b: number, a: number) =>
  a >= MIN_ALPHA && Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && r < 210;

function bbox(src: Raw, test: (i: number) => boolean) {
  let x0 = src.width;
  let y0 = src.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (!test((y * src.width + x) * 4)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const left = Math.max(0, x0 - PAD);
  const top = Math.max(0, y0 - PAD);
  return {
    left,
    top,
    width: Math.min(src.width, x1 + PAD + 1) - left,
    height: Math.min(src.height, y1 + PAD + 1) - top,
  };
}

/** Copy of the logo keeping only pixels that pass `keep`, optionally recoloured. */
function isolate(src: Raw, keep: (i: number) => boolean, rgb?: readonly [number, number, number]): Buffer {
  const out = Buffer.alloc(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    if (!keep(i)) continue;
    out[i] = rgb ? rgb[0] : src.data[i];
    out[i + 1] = rgb ? rgb[1] : src.data[i + 1];
    out[i + 2] = rgb ? rgb[2] : src.data[i + 2];
    out[i + 3] = src.data[i + 3];
  }
  return out;
}

const png = (buf: Buffer, w: number, h: number) => sharp(buf, { raw: { width: w, height: h, channels: 4 } });

/** Grayscale silhouette ops on a single-channel buffer. */
async function blurThreshold(gray: Buffer, w: number, h: number, sigma: number, threshold: number): Promise<Buffer> {
  // sharp widens 1-channel input to 3 channels; take one back.
  const blurred = await sharp(gray, { raw: { width: w, height: h, channels: 1 } })
    .blur(sigma)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < out.length; i++) out[i] = blurred[i] >= threshold ? 255 : 0;
  return out;
}

/** Everything not reachable from the border through empty pixels is inside. */
function fillHoles(gray: Buffer, w: number, h: number): Buffer {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!outside[i] && gray[i] === 0) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 255;
  return out;
}

/** Crown centred on a square canvas; `fill` = share of the side the crown's width takes. */
async function squareIcon(crown: Buffer, size: number, fill: number, background?: typeof ICON_BG): Promise<Buffer> {
  const inner = Math.round(size * fill);
  const scaled = await sharp(crown).resize(inner, inner, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const meta = await sharp(scaled).metadata();
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: scaled, left: Math.round((size - meta.width!) / 2), top: Math.round((size - meta.height!) / 2) },
    ])
    .png()
    .toBuffer();
}

/** .ico container holding PNG images (supported by all current browsers). */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette colours
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

/**
 * Tab-size icon: the crown's thin lines vanish when downscaled, so recolour to solid brand red and
 * strengthen faint pixels (alpha ^ boost). boost 1 = unchanged.
 */
async function smallIcon(src: string, size: number, boost: number): Promise<Buffer> {
  const { data, info } = await sharp(src)
    .resize(size, size, { fit: 'inside', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0xac;
    data[i + 1] = 0x1f;
    data[i + 2] = 0x2d;
    data[i + 3] = Math.min(255, Math.round(255 * (data[i + 3] / 255) ** boost));
  }
  const img = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function writeIcons(crownPng: string, maskPng: string) {
  const crown = await sharp(crownPng).toBuffer();
  // 16 px: solid silhouette (detail is unreadable at that size); 32/48 px: strengthened detailed crown.
  const pngs = [
    { size: 16, data: await smallIcon(maskPng, 16, 1) },
    { size: 32, data: await smallIcon(crownPng, 32, 0.45) },
    { size: 48, data: await smallIcon(crownPng, 48, 0.55) },
  ];
  await writeFile(path.join(APP_DIR, 'favicon.ico'), ico(pngs));
  await writeFile(path.join(APP_DIR, 'icon.png'), await squareIcon(crown, 512, 0.94));
  await writeFile(path.join(APP_DIR, 'apple-icon.png'), await squareIcon(crown, 180, 0.72, ICON_BG));
}

async function main() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const src: Raw = { data, width: info.width, height: info.height };
  const red = (i: number) => isRed(data[i], data[i + 1], data[i + 3]);
  const grey = (i: number) => isGrey(data[i], data[i + 1], data[i + 2], data[i + 3]) && !red(i);

  const crownBox = bbox(src, red);
  const wordBox = bbox(src, grey);
  const all = bbox(src, (i) => red(i) || grey(i));

  // crown.png
  await png(isolate(src, red), src.width, src.height).extract(crownBox).png().toFile(path.join(DIR, 'crown.png'));
  // wordmark.png
  await png(isolate(src, grey, WORDMARK_ON_DARK), src.width, src.height)
    .extract(wordBox)
    .png()
    .toFile(path.join(DIR, 'wordmark.png'));
  // logo-dark.png
  const dark = Buffer.alloc(data.length);
  isolate(src, red).copy(dark);
  const greyOnly = isolate(src, grey, WORDMARK_ON_DARK);
  for (let i = 0; i < dark.length; i += 4) if (greyOnly[i + 3]) greyOnly.copy(dark, i, i, i + 4);
  await png(dark, src.width, src.height).extract(all).png().toFile(path.join(DIR, 'logo-dark.png'));

  // crown-mask.png: upscale crown alpha → join the dotted outline (dilate) → fill holes → erode back.
  const w = crownBox.width * MASK_SCALE;
  const h = crownBox.height * MASK_SCALE;
  const alpha = await png(isolate(src, red), src.width, src.height)
    .extract(crownBox)
    .resize(w, h, { kernel: 'lanczos3' })
    .extractChannel(3)
    .raw()
    .toBuffer();
  const solid = await blurThreshold(alpha, w, h, 0.5, 100);
  const dilated = await blurThreshold(solid, w, h, 3.2 * MASK_SCALE, 18);
  const filled = fillHoles(dilated, w, h);
  const eroded = await blurThreshold(filled, w, h, 2.4 * MASK_SCALE, 236);
  const smooth = await blurThreshold(eroded, w, h, 1.2, 128);
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = smooth[i];
  }
  await png(rgba, w, h).png().toFile(path.join(DIR, 'crown-mask.png'));

  await writeIcons(path.join(DIR, 'crown.png'), path.join(DIR, 'crown-mask.png'));

  console.log('crown     ', crownBox);
  console.log('wordmark  ', wordBox);
  console.log('mask      ', `${w}x${h}`);
  console.log(`Wrote crown.png, wordmark.png, logo-dark.png, crown-mask.png to ${DIR}`);
  console.log(`Wrote favicon.ico, icon.png, apple-icon.png to ${APP_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
