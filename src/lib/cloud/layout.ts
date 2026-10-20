// Masked word-cloud layout (pure). Runs in a Web Worker on Screen 2.
// Words are packed as padded rectangles on the mask's cell grid; no canvas needed here —
// text widths are measured once on the main thread and passed in as `widths`.
import { CLOUD_PALETTE } from '@/config/brand';
import type { MaskGrid } from '@/lib/mask/mask';
import { hashString, rng, type Rng } from '@/lib/random';

export type CloudWord = {
  /** `${questionId}:${optionId}` */
  key: string;
  /** Option label as written in config (e.g. "Innovation"). */
  label: string;
  questionId: string;
  count: number;
};

export type WordFont = 'sans' | 'serif';
/** 0 top · 1 rose · 2 brand red · 3 least chosen · 4 filler */
export type WordTier = 0 | 1 | 2 | 3 | 4;

export type PlacedWord = {
  /** hero: option key; filler: `${optionKey}#n` */
  key: string;
  optionKey: string;
  /** Text as drawn: UPPERCASE for sans, Title Case for serif. */
  text: string;
  questionId: string;
  /** Centre, stage px. */
  x: number;
  y: number;
  size: number;
  rotate: 0 | 90;
  color: string;
  opacity: number;
  layer: 'hero' | 'filler';
  tier: WordTier;
  font: WordFont;
};

export type LayoutOptions = {
  seed: string;
  minHero: number;
  maxHero: number;
  fillerMin: number;
  fillerMax: number;
  /** Stop adding filler once this share of mask cells is covered. */
  coverage: number;
  includeFiller: boolean;
  /** Heroes never wider than this share of the crown width. */
  maxHeroWidthRatio: number;
  /** Consecutive failed filler placements per size band before moving to a smaller band. */
  fillerFailLimit: number;
  /** Multiplies filler opacity (dim empty state). */
  fillerOpacityScale: number;
};

export const DEFAULT_LAYOUT: Omit<LayoutOptions, 'seed'> = {
  minHero: 16,
  maxHero: 120,
  fillerMin: 12,
  fillerMax: 22,
  coverage: 0.85,
  includeFiller: true,
  maxHeroWidthRatio: 0.8,
  fillerFailLimit: 70,
  fillerOpacityScale: 1,
};

/** Box height relative to font size: uppercase heavy sans (cap height) / title-case serif (with descenders). */
export const BOX_HEIGHT: Record<WordFont, number> = { sans: 0.8, serif: 1.05 };
const HERO_PAD = 1;
const FILLER_PAD = 1;
/** Heroes may use at most this share of the crown, leaving room for the spiky edges + filler. */
const HERO_AREA_SHARE = 0.6;
/** Hero rank boundaries for tiers 0, 1, 2 (rank < value); the rest are tier 3. */
const TIER_RANKS = [3, 10, 18] as const;
/** Serif is used for about one in three tier-1/2 heroes, picked by a stable hash of the option. */
const SERIF_EVERY = 3;
const SERIF_MIN_SIZE = 26;

export function wordText(font: WordFont, label: string): string {
  return font === 'sans' ? label.toUpperCase() : label;
}

/** Key into the `widths` table. */
export function widthKey(font: WordFont, text: string): string {
  return `${font}|${text}`;
}

export function heroSize(count: number, maxCount: number, min: number, max: number): number {
  if (maxCount <= 0) return min;
  return min + (max - min) * Math.sqrt(count / maxCount);
}

export function tierForRank(rank: number, count: number): Exclude<WordTier, 4> {
  if (count <= 0) return 3;
  if (rank < TIER_RANKS[0]) return 0;
  if (rank < TIER_RANKS[1]) return 1;
  if (rank < TIER_RANKS[2]) return 2;
  return 3;
}

function heroFont(key: string, tier: WordTier): WordFont {
  if (tier !== 1 && tier !== 2) return 'sans';
  return parseInt(hashString(key), 36) % SERIF_EVERY === 0 ? 'serif' : 'sans';
}

class Occupancy {
  readonly blocked: Uint8Array;
  covered = 0;
  constructor(readonly mask: MaskGrid) {
    this.blocked = new Uint8Array(mask.inside.length);
    for (let i = 0; i < mask.inside.length; i++) this.blocked[i] = mask.inside[i] ? 0 : 1;
  }

  fits(left: number, top: number, w: number, h: number): boolean {
    const { cols, rows } = this.mask;
    if (left < 0 || top < 0 || left + w > cols || top + h > rows) return false;
    const b = this.blocked;
    const r2 = top + h - 1;
    const c2 = left + w - 1;
    // Cheap probes first: corners + centre.
    if (
      b[top * cols + left] ||
      b[top * cols + c2] ||
      b[r2 * cols + left] ||
      b[r2 * cols + c2] ||
      b[(top + (h >> 1)) * cols + left + (w >> 1)]
    ) {
      return false;
    }
    for (let r = top; r <= r2; r++) {
      const row = r * cols;
      for (let c = left; c <= c2; c++) if (b[row + c]) return false;
    }
    return true;
  }

  mark(left: number, top: number, w: number, h: number) {
    const cols = this.mask.cols;
    for (let r = top; r < top + h; r++) {
      const row = r * cols;
      for (let c = left; c < left + w; c++) this.blocked[row + c] = 1;
    }
    this.covered += w * h;
  }

  get coverage() {
    return this.mask.insideCount ? this.covered / this.mask.insideCount : 1;
  }
}

/** Archimedean spiral search around (cx, cy) in cells. Returns top-left cell or null. */
function spiral(
  occ: Occupancy,
  cx: number,
  cy: number,
  w: number,
  h: number,
  maxRadius: number,
  aspect: number,
  growth: number,
  maxSteps: number,
  startAngle: number,
): { left: number; top: number } | null {
  let theta = 0;
  for (let step = 0; step < maxSteps; step++) {
    const r = growth * theta;
    if (r > maxRadius) break;
    const a = theta + startAngle;
    const left = Math.round(cx + r * Math.cos(a) * aspect - w / 2);
    const top = Math.round(cy + r * Math.sin(a) - h / 2);
    if (occ.fits(left, top, w, h)) return { left, top };
    theta += r > 1 ? Math.min(0.5, 1.2 / r) : 0.5;
  }
  return null;
}

function box(textWidthPerPx: number, size: number, cell: number, pad: number, rotate: 0 | 90, font: WordFont) {
  const tw = Math.ceil((textWidthPerPx * size) / cell) + pad * 2;
  const th = Math.ceil((size * BOX_HEIGHT[font]) / cell) + pad * 2;
  return rotate === 0 ? { w: tw, h: th } : { w: th, h: tw };
}

function weightedPick<T>(items: T[], weights: number[], random: Rng): T {
  let total = 0;
  for (const w of weights) total += w;
  let x = random() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function layoutCloud(
  mask: MaskGrid,
  words: CloudWord[],
  /** Width per 1px of font size, keyed by widthKey(font, text). */
  widths: Record<string, number>,
  opts: LayoutOptions,
): PlacedWord[] {
  const random = rng(opts.seed);
  const occ = new Occupancy(mask);
  const { cell, centroid, bounds } = mask;
  const maskW = Math.max(1, bounds.maxX - bounds.minX + 1);
  const maskH = Math.max(1, bounds.maxY - bounds.minY + 1);
  const aspect = maskW / maskH;
  const maxRadius = Math.hypot(maskW, maskH);
  const placed: PlacedWord[] = [];
  const widthOf = (font: WordFont, text: string) => widths[widthKey(font, text)] ?? text.length * 0.75;

  const place = (
    w: CloudWord,
    key: string,
    left: number,
    top: number,
    bw: number,
    bh: number,
    style: Pick<PlacedWord, 'text' | 'size' | 'rotate' | 'color' | 'opacity' | 'layer' | 'tier' | 'font'>,
  ) => {
    occ.mark(left, top, bw, bh);
    placed.push({
      key,
      optionKey: w.key,
      questionId: w.questionId,
      x: (left + bw / 2) * cell,
      y: (top + bh / 2) * cell,
      ...style,
    });
  };

  // ── Heroes: every option once, sized by count, spiralling out from the centroid.
  const maxCount = Math.max(0, ...words.map((w) => w.count));
  if (maxCount > 0) {
    const heroes = words
      .slice()
      .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((w, rank) => {
        const tier = tierForRank(rank, w.count);
        const font = heroFont(w.key, tier);
        const text = wordText(font, w.label);
        return { w, tier, font, text, perPx: widthOf(font, text) };
      });
    const maxWidthPx = maskW * cell * opts.maxHeroWidthRatio;
    const raw = heroes.map((h) =>
      Math.min(heroSize(h.w.count, maxCount, opts.minHero, opts.maxHero), maxWidthPx / h.perPx),
    );
    // Keep total hero area within budget so every option fits. Shrink only the part above
    // minHero first (keeps the ranking visible); if even all-minimum is too big, scale everything.
    const budget = HERO_AREA_SHARE * mask.insideCount;
    const areaOf = (sizes: number[]) =>
      heroes.reduce((s, h, i) => {
        const b = box(h.perPx, sizes[i], cell, HERO_PAD, 0, h.font);
        return s + b.w * b.h;
      }, 0);
    const withK = (k: number) => raw.map((s) => Math.max(Math.min(s, opts.minHero), opts.minHero + (s - opts.minHero) * k));
    const withScale = (k: number) => raw.map(() => Math.max(opts.fillerMin, opts.minHero * k));
    let sizes = withK(1);
    if (areaOf(sizes) > budget) {
      const fits = (k: number, f: (k: number) => number[]) => areaOf(f(k)) <= budget;
      const mode = fits(0, withK) ? withK : withScale;
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, mode)) lo = mid;
        else hi = mid;
      }
      sizes = mode(lo);
    }

    heroes.forEach((h, rank) => {
      let size = sizes[rank];
      // The serif only where it is big enough to stay bold on an LED wall.
      const font: WordFont = h.font === 'serif' && size < SERIF_MIN_SIZE ? 'sans' : h.font;
      const text = wordText(font, h.w.label);
      const perPx = widthOf(font, text);
      const startAngle = random() * Math.PI * 2;
      while (size >= opts.fillerMin) {
        const { w: bw, h: bh } = box(perPx, size, cell, HERO_PAD, 0, font);
        const spot = spiral(occ, centroid.x, centroid.y, bw, bh, maxRadius, aspect, 0.45, 60000, startAngle);
        if (spot) {
          place(h.w, h.w.key, spot.left, spot.top, bw, bh, {
            text,
            size,
            rotate: 0,
            color: CLOUD_PALETTE.tiers[h.tier],
            opacity: 1,
            layer: 'hero',
            tier: h.tier,
            font,
          });
          return;
        }
        size *= 0.88;
      }
    });
  }

  if (!opts.includeFiller || words.length === 0) return placed;

  // ── Filler: repeat options at small sizes until the crown is covered.
  const insideList: number[] = [];
  for (let i = 0; i < mask.inside.length; i++) if (mask.inside[i]) insideList.push(i);
  if (!insideList.length) return placed;

  const total = words.reduce((s, w) => s + w.count, 0);
  const floor = 0.35 / words.length;
  const weights = words.map((w) => (total > 0 ? w.count / total : 1 / words.length) + floor);
  const counters = new Map<string, number>();
  const fillerColors = CLOUD_PALETTE.filler;

  const tryFiller = (w: CloudWord, size: number): boolean => {
    const rotate: 0 | 90 = random() < 0.2 ? 90 : 0;
    const text = wordText('sans', w.label);
    const { w: bw, h: bh } = box(widthOf('sans', text), size, cell, FILLER_PAD, rotate, 'sans');
    for (let probe = 0; probe < 4; probe++) {
      const idx = insideList[Math.floor(random() * insideList.length)];
      if (occ.blocked[idx]) continue;
      const cx = idx % mask.cols;
      const cy = Math.floor(idx / mask.cols);
      const spot = spiral(occ, cx, cy, bw, bh, 18, 1, 0.35, 120, random() * Math.PI * 2);
      if (spot) {
        const n = counters.get(w.key) ?? 0;
        counters.set(w.key, n + 1);
        place(w, `${w.key}#${n}`, spot.left, spot.top, bw, bh, {
          text,
          size,
          rotate,
          color: fillerColors[Math.floor(random() * fillerColors.length)],
          opacity: (0.32 + random() * 0.22) * opts.fillerOpacityScale,
          layer: 'filler',
          tier: 4,
          font: 'sans',
        });
        return true;
      }
    }
    return false;
  };

  // Floor: every option appears a few times, mid-sized.
  const mid = (opts.fillerMin + opts.fillerMax) / 2;
  for (let round = 0; round < 3; round++) {
    for (const w of words) tryFiller(w, mid + 2 - round * 2);
  }

  for (let band = opts.fillerMax; band >= opts.fillerMin && occ.coverage < opts.coverage; band -= 2) {
    let failures = 0;
    while (failures < opts.fillerFailLimit && occ.coverage < opts.coverage) {
      const w = weightedPick(words, weights, random);
      const size = band - random() * 1.5;
      if (tryFiller(w, size)) failures = 0;
      else failures++;
    }
  }
  return placed;
}

function placedCells(p: PlacedWord, widths: Record<string, number>, cell: number) {
  const pad = p.layer === 'hero' ? HERO_PAD : FILLER_PAD;
  return box(widths[widthKey(p.font, p.text)] ?? p.text.length * 0.75, p.size, cell, pad, p.rotate, p.font);
}

export function coverageOf(mask: MaskGrid, placed: PlacedWord[], widths: Record<string, number>): number {
  let covered = 0;
  for (const p of placed) {
    const b = placedCells(p, widths, mask.cell);
    covered += b.w * b.h;
  }
  return mask.insideCount ? covered / mask.insideCount : 0;
}

/** Box of a placed word in cells (for overlap / inside tests). */
export function placedBox(p: PlacedWord, widths: Record<string, number>, cell: number) {
  const b = placedCells(p, widths, cell);
  return { left: Math.round(p.x / cell - b.w / 2), top: Math.round(p.y / cell - b.h / 2), w: b.w, h: b.h };
}
