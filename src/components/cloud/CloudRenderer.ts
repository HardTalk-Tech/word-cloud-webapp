// Screen 2 engine: responses → counts → masked layout (worker) → tween → canvas.
// The wordmark under the crown is built from tiny letters; new answers' letters fly out of it into the crown.
import { BRAND, CLOUD_PALETTE, WORDMARK_MOSAIC } from '@/config/brand';
import { QUESTIONS } from '@/config/questions';
import { MAX_DPR, STAGE } from '@/config/stage';
import { CLOUD } from '@/config/timings';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp, lerpColor, progress, type Rect } from '@/lib/anim';
import { aggregate, bucketedCountsKey, countsKey, optionKey, type Aggregate } from '@/lib/cloud/aggregate';
import {
  BOX_HEIGHT,
  DEFAULT_LAYOUT,
  layoutCloud,
  widthKey,
  wordText,
  type CloudWord,
  type LayoutOptions,
  type PlacedWord,
  type WordFont,
} from '@/lib/cloud/layout';
import type { LayoutRequest, LayoutResponse } from '@/lib/cloud/layout.worker';
import { flightPoint, letterSchedule, letterTargets, type Point } from '@/lib/cloud/letterFlight';
import { buildLetterMosaic, pickSource, type Glyph } from '@/lib/cloud/letterMosaic';
import { createTransition, type FrameWord, type Transition } from '@/lib/cloud/tween';
import { ensureFonts, fontFamilies, type FontFamilies } from '@/lib/fonts';
import { containRect, loadMask, type LoadedMask } from '@/lib/mask/mask';
import { outlineDots, type OutlineDot } from '@/lib/mask/outline';
import { hashString } from '@/lib/random';
import { DEFAULT_CONTROL, type ControlState, type ResponseDoc } from '@/types/models';
import {
  NO_BRAND_IMAGES,
  clearStage,
  drawWordmark,
  ellipsize,
  fitFontSize,
  glowSprite,
  loadBrandImages,
  setupCanvas,
  type BrandImages,
} from '@/components/stage/canvas';
import type { DebugStats } from '@/components/stage/DebugOverlay';

const W = STAGE.width;
const H = STAGE.height;
const CROWN_BOX: Rect = { x: W * 0.02, y: H * 0.035, w: W * 0.96, h: H * 0.68 };
/** "George Steuart / HEALTH" under the crown cloud, built from tiny letters. */
const WORDMARK_Y = H * 0.865;
const WORDMARK_W = W * WORDMARK_MOSAIC.widthRatio;
/** Size of the letters the wordmark is made of. */
const GLYPH_SIZE = WORDMARK_MOSAIC.cell * WORDMARK_MOSAIC.fontScale;
/** Flying letters rise this far out of the wordmark before arcing into the crown. */
const POP_LIFT = 12;
const MASK_CELL = 3;
const TAU = Math.PI * 2;
/** Outline lights: distance outside the crown edge (cells) and spacing (stage px). */
const OUTLINE_OFFSET_CELLS = 4;
const OUTLINE_SPACING = 20;
/** Baseline offset from the word box centre, × font size. */
const BASELINE: Record<WordFont, number> = { sans: BOX_HEIGHT.sans * 0.45, serif: 0.3 };

/** One letter of a new answer: leaves glyph `glyph` of the wordmark and lands on letter `index` of the word. */
type LetterFlight = { glyph: number; index: number; char: string; offset: number; bend: number; lift: number; lastSpark: number };
type Flyer = { key: string; text: string; start: number; letters: LetterFlight[]; pulsed: boolean };

/** Soft four-point star (thin cross of light around a small glow), for the sparks trailing flying letters. */
function makeStarSprite(color: string, size = 48): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const m = size / 2;
  const core = ctx.createRadialGradient(m, m, 0, m, m, m * 0.45);
  core.addColorStop(0, color);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = color;
  for (const rot of [0, Math.PI / 2]) {
    ctx.save();
    ctx.translate(m, m);
    ctx.rotate(rot);
    // Long thin diamond: bright centre, tapering points.
    ctx.beginPath();
    ctx.moveTo(-m, 0);
    ctx.quadraticCurveTo(0, -m * 0.09, m, 0);
    ctx.quadraticCurveTo(0, m * 0.09, -m, 0);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

/** Small stable integer hash, for picking twinkling glyphs. */
function mix(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const fontCss = (fonts: FontFamilies, font: WordFont, size: number) =>
  font === 'serif' ? `700 ${size.toFixed(1)}px ${fonts.serif}` : `800 ${size.toFixed(1)}px ${fonts.display}`;

/** Stable 0..1 per key, so each word twinkles / breathes on its own rhythm. */
function phaseOf(key: string): number {
  return (parseInt(hashString(key), 36) % 1000) / 1000;
}

export class CloudRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fonts: FontFamilies;
  private mask: LoadedMask | null = null;
  private brand: BrandImages = NO_BRAND_IMAGES;
  private widths: Record<string, number> | null = null;
  private outline: OutlineDot[] = [];
  private readonly outlineSprite: HTMLCanvasElement;
  private readonly sparkSprite: HTMLCanvasElement;
  private readonly starSprite: HTMLCanvasElement;
  private readonly phases = new Map<string, number>();

  /** Letter-mosaic wordmark: glyph positions + all of them pre-rendered once. */
  private glyphs: Glyph[] = [];
  private mosaic: { sprite: HTMLCanvasElement; rect: Rect } | null = null;
  /** Current wordmark transform (it grows a little in the finale). */
  private markScale = 1;
  private markShift = 0;

  /** Star sparks: a fixed ring buffer, reused (no per-frame allocation). */
  private readonly sparks = {
    x: new Float32Array(CLOUD.maxSparks),
    y: new Float32Array(CLOUD.maxSparks),
    vx: new Float32Array(CLOUD.maxSparks),
    vy: new Float32Array(CLOUD.maxSparks),
    size: new Float32Array(CLOUD.maxSparks),
    born: new Float64Array(CLOUD.maxSparks).fill(-Infinity),
  };
  private sparkNext = 0;
  private lastSparkAt = -Infinity;

  private control: ControlState = DEFAULT_CONTROL;
  private controlLoaded = false;
  private responses: ResponseDoc[] = [];
  private responsesLoaded = false;
  private stale = new Set<string>();
  private agg: Aggregate = aggregate([], QUESTIONS);
  private counts = new Map<string, number>();

  private current: PlacedWord[] = [];
  private transition: Transition | null = null;
  private transitionAt = 0;
  private frameWords: FrameWord[] = [];
  private needsLayout = true;
  private lastLayoutAt = -Infinity;
  private layoutKey = '';
  private inflight = false;
  private worker: Worker | null = null;
  private reqId = 0;
  private lastLayoutMs = 0;

  private pulses = new Map<string, number>();
  private flyers: Flyer[] = [];
  private focusFrom: string | null = null;
  private focusTo: string | null = null;
  private focusAt = -Infinity;
  private finalFrom = 0;
  private finalTo = 0;
  private finalAt = -Infinity;

  private dirty = true;
  private lastDrawAt = 0;
  private raf = 0;
  private destroyed = false;
  private frames = 0;
  private drawn = 0;
  private fps = 0;
  private drawFps = 0;
  private fpsAt = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly eventId: string,
  ) {
    this.ctx = setupCanvas(canvas, W, H, { transparent: true });
    this.fonts = fontFamilies();
    this.outlineSprite = glowSprite(CLOUD_PALETTE.outline);
    this.sparkSprite = glowSprite('#FFD9DD');
    this.starSprite = makeStarSprite(WORDMARK_MOSAIC.spark);
    try {
      this.worker = new Worker(new URL('../../lib/cloud/layout.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<LayoutResponse>) => this.onLayout(e.data);
      this.worker.onerror = (e) => {
        console.warn('Layout worker failed, using main thread', e);
        this.worker?.terminate();
        this.worker = null;
        this.inflight = false;
      };
    } catch {
      this.worker = null;
    }
  }

  async init() {
    const [brand] = await Promise.all([loadBrandImages(), ensureFonts(this.fonts)]);
    this.brand = brand;
    this.measure();
    this.buildMosaic();
    try {
      // Words fill the crown silhouette; crown.png (same crop box) is drawn faintly on the same rect.
      const m = await loadMask(BRAND.crownMask, W, H, CROWN_BOX, MASK_CELL);
      if (this.destroyed) return;
      this.mask = m;
      this.outline = outlineDots(m.grid, OUTLINE_OFFSET_CELLS, OUTLINE_SPACING);
    } catch (e) {
      console.error('Crown mask failed to load', e);
    }
    this.needsLayout = true;
    this.lastLayoutAt = -Infinity;
    this.dirty = true;
  }

  /**
   * Draw wordmark.png into its rect, read the pixels back and pack tiny random letters into its strokes
   * (grey name, teal HEALTH). All glyphs are rendered once into a sprite; a frame draws it with one drawImage.
   */
  private buildMosaic() {
    const img = this.brand.wordmark;
    if (!img) return;
    const rect = containRect(img.naturalWidth, img.naturalHeight, {
      x: (W - WORDMARK_W) / 2,
      y: WORDMARK_Y - H * 0.15,
      w: WORDMARK_W,
      h: H * 0.3,
    });
    const w = Math.round(rect.w);
    const h = Math.round(rect.h);
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;
    sctx.drawImage(img, 0, 0, w, h);
    const { cell, seed } = WORDMARK_MOSAIC;
    this.glyphs = buildLetterMosaic(sctx.getImageData(0, 0, w, h).data, w, h, { x: rect.x, y: rect.y }, { cell, seed });

    const pad = Math.ceil(GLYPH_SIZE);
    const out: Rect = { x: rect.x - pad, y: rect.y - pad, w: w + pad * 2, h: h + pad * 2 };
    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const sprite = document.createElement('canvas');
    sprite.width = Math.round(out.w * dpr);
    sprite.height = Math.round(out.h * dpr);
    const ctx = sprite.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.font = `800 ${GLYPH_SIZE.toFixed(1)}px ${this.fonts.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const g of this.glyphs) {
      ctx.fillStyle = g.tone === 'health' ? WORDMARK_MOSAIC.health : WORDMARK_MOSAIC.name;
      ctx.fillText(g.char, g.x - out.x, g.y - out.y);
    }
    this.mosaic = { sprite, rect: out };
  }

  /** A wordmark glyph's position on screen right now (the wordmark grows slightly in the finale). */
  private glyphPoint(i: number): Point {
    const g = this.glyphs[i];
    return {
      x: W / 2 + (g.x - W / 2) * this.markScale,
      y: WORDMARK_Y + (g.y - WORDMARK_Y) * this.markScale - this.markShift,
    };
  }

  /** Text width per 1px of font size, for every label in both fonts. */
  private measure() {
    const ctx = this.ctx;
    ctx.save();
    const widths: Record<string, number> = {};
    const fontCss: Record<WordFont, string> = {
      sans: `800 100px ${this.fonts.display}`,
      serif: `700 100px ${this.fonts.serif}`,
    };
    for (const font of ['sans', 'serif'] as const) {
      ctx.font = fontCss[font];
      for (const q of QUESTIONS) {
        for (const o of q.options) {
          const t = wordText(font, o.label);
          widths[widthKey(font, t)] = ctx.measureText(t).width / 100;
        }
      }
    }
    ctx.restore();
    this.widths = widths;
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
    this.worker?.terminate();
    this.worker = null;
  }

  // ── Data ────────────────────────────────────────────────────────────

  onControl(next: ControlState) {
    const now = performance.now();
    const prev = this.control;
    if (this.controlLoaded && next.epoch !== prev.epoch) {
      // Reset: everything we have is old; show the empty crown right away.
      for (const r of this.responses) this.stale.add(r.id);
      this.recount(now, false);
      this.current = [];
      this.transition = null;
      this.frameWords = [];
      this.pulses.clear();
      this.flyers = [];
      this.sparks.born.fill(-Infinity);
      this.forceLayout();
    }
    if (!this.controlLoaded || next.mode !== prev.mode) {
      const target = next.mode === 'final' ? 1 : 0;
      this.finalFrom = this.controlLoaded ? this.finalAmount(now) : target;
      this.finalTo = target;
      this.finalAt = now;
      if (this.controlLoaded) this.forceLayout();
    }
    this.control = next;
    this.controlLoaded = true;
    this.dirty = true;
  }

  onResponses(list: ResponseDoc[]) {
    this.responses = list;
    // The first snapshot is history, not new answers: no fly-ins for it.
    this.recount(performance.now(), this.responsesLoaded);
    this.responsesLoaded = true;
  }

  private recount(now: number, celebrate: boolean) {
    const live = this.responses.filter((r) => !this.stale.has(r.id));
    this.agg = aggregate(live, QUESTIONS);
    if (celebrate) {
      for (const [k, n] of this.agg.byOption) {
        if (n > (this.counts.get(k) ?? 0)) this.spawnFlyer(k, now);
      }
    }
    this.counts = new Map(this.agg.byOption);
    if (countsKey(this.counts) !== this.layoutKey) this.needsLayout = true;
    this.dirty = true;
  }

  /**
   * A chosen word's letters pop out of matching letters in the wordmark, one after another, and fly into the
   * word in the crown; the word pulses as they land.
   */
  private spawnFlyer(key: string, now: number) {
    if (this.flyers.length >= CLOUD.maxFlyers || !this.glyphs.length) {
      this.pulses.set(key, now);
      return;
    }
    const [qid, oid] = key.split(':');
    const label = QUESTIONS.find((q) => q.id === qid)?.options.find((o) => o.id === oid)?.label ?? '';
    const text = label.toUpperCase();
    const indices = [...text].flatMap((ch, i) => (ch.trim() ? [i] : []));
    if (!indices.length) return;
    const offsets = letterSchedule(indices.length, CLOUD.letterStaggerMs);
    // Stagger words so a multi-select answer arrives as a little stream, not one blob.
    const lane = this.flyers.length;
    const bend = (Math.random() - 0.5) * W * 0.3;
    this.flyers.push({
      key,
      text,
      start: now + lane * 260,
      pulsed: false,
      letters: indices.map((index, k) => ({
        glyph: pickSource(this.glyphs, text[index]),
        index,
        char: text[index],
        offset: offsets[k],
        // Each letter takes a slightly different arc, like sparks off a wand.
        bend: bend + (Math.random() - 0.5) * W * 0.12,
        lift: H * (0.1 + Math.random() * 0.08),
        lastSpark: -Infinity,
      })),
    });
  }

  private forceLayout() {
    this.needsLayout = true;
    this.lastLayoutAt = -Infinity;
    this.layoutKey = '';
  }

  // ── Layout ──────────────────────────────────────────────────────────

  private requestLayout(now: number) {
    if (!this.mask || !this.widths) return;
    const isFinal = this.control.mode === 'final';
    const words: CloudWord[] = QUESTIONS.flatMap((q) =>
      q.options.map((o) => {
        const key = optionKey(q.id, o.id);
        return { key, label: o.label, questionId: q.id, count: this.counts.get(key) ?? 0 };
      }),
    );
    const options: LayoutOptions = {
      ...DEFAULT_LAYOUT,
      seed: `${this.eventId}|${bucketedCountsKey(this.counts)}|${isFinal ? 'final' : 'live'}`,
      includeFiller: !isFinal,
      maxHero: isFinal ? DEFAULT_LAYOUT.maxHero * 1.1 : DEFAULT_LAYOUT.maxHero,
      fillerOpacityScale: this.agg.respondents === 0 ? 0.55 : 1,
    };
    this.layoutKey = countsKey(this.counts);
    this.needsLayout = false;
    this.lastLayoutAt = now;
    const id = ++this.reqId;
    if (this.worker) {
      this.inflight = true;
      const req: LayoutRequest = { id, mask: this.mask.grid, words, widths: this.widths, options };
      this.worker.postMessage(req);
    } else {
      const t0 = performance.now();
      const placed = layoutCloud(this.mask.grid, words, this.widths, options);
      this.onLayout({ id, placed, ms: performance.now() - t0 });
    }
  }

  private onLayout(res: LayoutResponse) {
    this.inflight = false;
    if (res.id !== this.reqId || this.destroyed) return;
    const now = performance.now();
    this.lastLayoutMs = Math.round(res.ms);
    // Start from what is on screen right now (mid-tween safe).
    const prev: PlacedWord[] = this.transition
      ? this.frameWords.map((w) => ({ ...w, opacity: w.opacity * w.alpha })).filter((w) => w.opacity > 0.01)
      : this.current;
    this.transition = createTransition(prev, res.placed);
    this.transitionAt = now;
    this.current = res.placed;
    this.dirty = true;
  }

  // ── Frame ───────────────────────────────────────────────────────────

  private effectiveQuestion(): string | null {
    if (this.control.autoRotateQuestions && QUESTIONS.length) {
      return QUESTIONS[Math.floor(Date.now() / CLOUD.autoRotateEveryMs) % QUESTIONS.length].id;
    }
    return this.control.spotlightQuestion;
  }

  private finalAmount(now: number) {
    return lerp(this.finalFrom, this.finalTo, easeInOutCubic(progress(now, this.finalAt, CLOUD.tweenMs)));
  }

  private phase(key: string): number {
    let p = this.phases.get(key);
    if (p === undefined) {
      p = phaseOf(key);
      this.phases.set(key, p);
    }
    return p;
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

    if (this.needsLayout && !this.inflight && now - this.lastLayoutAt >= CLOUD.relayoutEveryMs) this.requestLayout(now);

    const q = this.effectiveQuestion();
    if (q !== this.focusTo) {
      this.focusFrom = this.focusTo;
      this.focusTo = q;
      this.focusAt = now;
      this.dirty = true;
    }

    // "fast" = something is moving noticeably → full frame rate; otherwise idle motion at idleFps.
    let fast = this.flyers.length > 0 || now - this.lastSparkAt < CLOUD.sparkLifeMs;
    if (this.transition) {
      const p = progress(now, this.transitionAt, CLOUD.tweenMs);
      this.frameWords = this.transition.sample(easeInOutCubic(p));
      if (p >= 1) this.transition = null;
      fast = true;
    } else if (this.frameWords.length !== this.current.length || this.frameWords[0]?.alpha !== 1) {
      this.frameWords = createTransition(this.current, this.current).sample(1);
    }
    for (const [k, t] of this.pulses) {
      if (now - t < CLOUD.pulseMs) fast = true;
      else this.pulses.delete(k);
    }
    if (now - this.focusAt < CLOUD.focusTweenMs || now - this.finalAt < CLOUD.tweenMs) fast = true;

    if (!fast && !this.dirty && now - this.lastDrawAt < 1000 / CLOUD.idleFps) return;
    this.draw(now);
    this.lastDrawAt = now;
    this.drawn++;
    this.dirty = false;
  }

  private focusFactor(questionId: string, now: number): number {
    const dim = (q: string | null) => (q && q !== questionId ? CLOUD.dimOpacity : 1);
    const p = easeInOutCubic(progress(now, this.focusAt, CLOUD.focusTweenMs));
    return lerp(dim(this.focusFrom), dim(this.focusTo), p);
  }

  private draw(now: number) {
    const ctx = this.ctx;
    clearStage(ctx, W, H);
    const fin = this.finalAmount(now);
    const empty = this.agg.respondents === 0 ? 1 : 0;

    // The George Steuart crown, faint behind the words, so the design reads even before anyone answers.
    if (this.brand.crown && this.mask) {
      const r = this.mask.rect;
      ctx.save();
      // Brighter when empty and in the finale (filler that outlined the crown has faded out).
      ctx.globalAlpha = 0.12 + 0.1 * empty + 0.16 * fin;
      ctx.drawImage(this.brand.crown, r.x, r.y, r.w, r.h);
      ctx.restore();
    }

    this.drawOutline(now, fin);
    this.drawWords(now);

    // Spotlight-question banner at the top, when shown.
    this.drawBanner(now);
    this.markScale = 1 + 0.04 * fin;
    this.markShift = fin * 6;
    if (this.mosaic) {
      this.drawMosaic(now);
    } else {
      // Image missing: plain text wordmark.
      drawWordmark(ctx, {
        x: W / 2,
        y: WORDMARK_Y - this.markShift,
        width: WORDMARK_W * this.markScale,
        height: 70,
        align: 'center',
        fonts: this.fonts,
        brand: this.brand,
        crown: false,
      });
    }
    this.drawSparks(now);
    this.drawFlyers(now);
  }

  /** The letter-mosaic wordmark, with a few of its letters twinkling. */
  private drawMosaic(now: number) {
    const m = this.mosaic;
    if (!m) return;
    const ctx = this.ctx;
    const s = this.markScale;
    const r = m.rect;
    ctx.drawImage(
      m.sprite,
      W / 2 + (r.x - W / 2) * s,
      WORDMARK_Y + (r.y - WORDMARK_Y) * s - this.markShift,
      r.w * s,
      r.h * s,
    );
    const n = this.glyphs.length;
    if (!n) return;
    ctx.save();
    ctx.font = `800 ${(GLYPH_SIZE * 1.15 * s).toFixed(1)}px ${this.fonts.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = WORDMARK_MOSAIC.twinkle;
    const count = CLOUD.twinkleCount;
    for (let k = 0; k < count; k++) {
      // Each twinkle slot lights a different glyph per cycle, out of step with the others.
      const t = now + (k * CLOUD.twinkleMs) / count;
      const cycle = Math.floor(t / CLOUD.twinkleMs);
      const p = (t % CLOUD.twinkleMs) / CLOUD.twinkleMs;
      const i = mix(cycle * 131 + k) % n;
      const pt = this.glyphPoint(i);
      const a = Math.sin(Math.PI * p);
      ctx.globalAlpha = 0.85 * a;
      ctx.fillText(this.glyphs[i].char, pt.x, pt.y);
    }
    ctx.restore();
  }

  private emitSpark(x: number, y: number, now: number) {
    const i = this.sparkNext;
    this.sparkNext = (i + 1) % CLOUD.maxSparks;
    const sp = this.sparks;
    sp.x[i] = x + (Math.random() - 0.5) * 6;
    sp.y[i] = y + (Math.random() - 0.5) * 6;
    sp.vx[i] = (Math.random() - 0.5) * 50;
    sp.vy[i] = (Math.random() - 0.5) * 40 - 8;
    sp.size[i] = 9 + Math.random() * 12;
    sp.born[i] = now;
    this.lastSparkAt = now;
  }

  /** Soft star sparks drifting down and fading behind the flying letters. */
  private drawSparks(now: number) {
    if (now - this.lastSparkAt >= CLOUD.sparkLifeMs) return;
    const ctx = this.ctx;
    const sp = this.sparks;
    const gravity = 45;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < CLOUD.maxSparks; i++) {
      const age = (now - sp.born[i]) / CLOUD.sparkLifeMs;
      if (!(age >= 0 && age < 1)) continue;
      const t = (now - sp.born[i]) / 1000;
      const x = sp.x[i] + sp.vx[i] * t;
      const y = sp.y[i] + sp.vy[i] * t + 0.5 * gravity * t * t;
      const twinkle = 0.6 + 0.4 * Math.sin(now / 70 + i * 1.7);
      ctx.globalAlpha = 0.45 * (1 - age) ** 1.4 * twinkle;
      const size = sp.size[i] * (1 - 0.5 * age);
      ctx.drawImage(this.starSprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  /** Lights along the crown edge (like the dotted arch in the logo) with a slow chase. */
  private drawOutline(now: number, fin: number) {
    const dots = this.outline;
    if (!dots.length) return;
    const ctx = this.ctx;
    const t = now / 1000;
    const n = dots.length;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const chase = Math.max(0, Math.cos(TAU * ((i / n) * 3) - t * 1.6)) ** 4;
      const a = clamp(0.3 + 0.55 * chase + 0.25 * fin, 0, 1);
      const r = 5 + 5 * chase + 2 * fin;
      ctx.globalAlpha = a;
      ctx.drawImage(this.outlineSprite, dots[i].x - r, dots[i].y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  private drawWords(now: number) {
    const ctx = this.ctx;
    const t = now / 1000;
    const [hr, hg, hb] = CLOUD_PALETTE.halo;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const w of this.frameWords) {
      let alpha = w.alpha * w.opacity * this.focusFactor(w.questionId, now);
      if (alpha <= 0.01) continue;
      const ph = this.phase(w.key);
      let size = w.size;
      let glow = 0;
      if (w.layer === 'filler') {
        // Small words softly twinkle.
        alpha *= 0.72 + 0.28 * Math.sin(t * (0.7 + ph) + ph * TAU);
      } else {
        // Big words breathe slightly.
        size *= 1 + 0.018 * Math.sin(t * 0.9 + ph * TAU);
        const pulseAt = this.pulses.get(w.optionKey);
        if (pulseAt !== undefined) {
          glow = Math.sin(Math.PI * clamp((now - pulseAt) / CLOUD.pulseMs, 0, 1));
          size *= 1 + 0.1 * glow;
        }
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w.x, w.y);
      if (w.rotate === 90) ctx.rotate(-Math.PI / 2);
      ctx.font = fontCss(this.fonts, w.font, size);
      const y = size * BASELINE[w.font];
      // Red halo (two wide strokes, cheaper than shadowBlur): always on the top tier, briefly on a pulse.
      const halo = w.tier === 0 ? 1 : glow;
      if (halo > 0) {
        ctx.strokeStyle = `rgba(${hr},${hg},${hb},${0.22 * halo + 0.15 * glow})`;
        ctx.lineWidth = size * 0.34;
        ctx.strokeText(w.text, 0, y);
        ctx.strokeStyle = `rgba(${hr},${hg},${hb},${0.5 * halo + 0.2 * glow})`;
        ctx.lineWidth = size * 0.15;
        ctx.strokeText(w.text, 0, y);
      }
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, 0, y);
      ctx.restore();
    }
  }

  private drawFlyers(now: number) {
    if (!this.flyers.length) return;
    const ctx = this.ctx;
    // Land on the option's big word; if it isn't one (outside the top options), on one of its small copies.
    const target = new Map<string, FrameWord>();
    for (const w of this.frameWords) if (w.layer === 'filler' && w.alpha > 0.5) target.set(w.optionKey, w);
    for (const w of this.frameWords) if (w.layer === 'hero' && w.alpha > 0.5) target.set(w.optionKey, w);
    const fallback = this.mask
      ? { x: this.mask.rect.x + this.mask.rect.w / 2, y: this.mask.rect.y + this.mask.rect.h * 0.6 }
      : { x: W / 2, y: H / 2 };
    const pop = CLOUD.letterPopMs;
    const fly = CLOUD.letterFlyMs;
    const land = CLOUD.letterLandMs;

    const done: Flyer[] = [];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const f of this.flyers) {
      const w = target.get(f.key);
      const text = w?.text ?? f.text;
      const font: WordFont = w?.font ?? 'sans';
      const size = w?.size ?? 26;
      const rotate = w?.rotate === 90 ? 90 : 0;
      ctx.font = fontCss(this.fonts, font, size);
      const widths = [...text].map((ch) => ctx.measureText(ch).width);
      const targets = letterTargets(w ?? fallback, widths, rotate);
      const toColor = w?.color ?? BRAND.white;

      let alive = false;
      let allLanding = true;
      for (const L of f.letters) {
        const t = now - (f.start + L.offset);
        if (t < pop + fly) allLanding = false;
        if (t < 0) {
          alive = true;
          continue;
        }
        if (t >= pop + fly + land) continue;
        alive = true;
        const from = this.glyphPoint(L.glyph);
        const g = this.glyphs[L.glyph];
        const toneColor = g.tone === 'health' ? WORDMARK_MOSAIC.health : WORDMARK_MOSAIC.name;
        const to = targets[L.index] ?? targets[targets.length - 1] ?? fallback;
        const ch = text[L.index] ?? L.char;
        let pos: Point;
        let letterSize: number;
        let color: string;
        let alpha = 1;
        let angle = 0;
        if (t < pop) {
          // Pop: the letter swells up out of its spot in the wordmark with a soft flash.
          const q = t / pop;
          pos = { x: from.x, y: from.y - POP_LIFT * easeOutCubic(q) };
          letterSize = GLYPH_SIZE * (1 + 0.9 * Math.max(0, easeOutBack(q)));
          color = lerpColor(toneColor, BRAND.white, q);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.45 * Math.sin(Math.PI * q);
          ctx.drawImage(this.sparkSprite, from.x - 16, from.y - 16, 32, 32);
          ctx.restore();
        } else if (t < pop + fly) {
          // Fly: arc up and over into its place in the word, growing to the word's size.
          const q = easeInOutCubic((t - pop) / fly);
          pos = flightPoint({ x: from.x, y: from.y - POP_LIFT }, to, L.bend, L.lift, q);
          letterSize = lerp(GLYPH_SIZE * 1.9, size, q);
          color = q < 0.6 ? BRAND.white : lerpColor(BRAND.white, toColor, (q - 0.6) / 0.4);
          angle = rotate === 90 ? (-Math.PI / 2) * q : 0;
          if (now - L.lastSpark >= CLOUD.sparkEveryMs) {
            L.lastSpark = now;
            this.emitSpark(pos.x, pos.y, now);
          }
        } else {
          // Land: settle into the word and fade as the word pulses.
          const q = (t - pop - fly) / land;
          pos = to;
          letterSize = size;
          color = toColor;
          alpha = 1 - q;
          angle = rotate === 90 ? -Math.PI / 2 : 0;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(pos.x, pos.y);
        if (angle) ctx.rotate(angle);
        ctx.font = fontCss(this.fonts, font, letterSize);
        ctx.fillStyle = color;
        // Same baseline as the word, so the letters land exactly on it.
        ctx.fillText(ch, 0, letterSize * BASELINE[font]);
        ctx.restore();
      }
      if (allLanding && !f.pulsed) {
        f.pulsed = true;
        this.pulses.set(f.key, now);
      }
      if (!alive) done.push(f);
    }
    ctx.restore();
    if (done.length) this.flyers = this.flyers.filter((f) => !done.includes(f));
  }

  /** Spotlight-question banner at the top. Returns how visible it is (0..1). */
  private drawBanner(now: number): number {
    const p = easeInOutCubic(progress(now, this.focusAt, CLOUD.focusTweenMs));
    const show = (q: string | null) => (q ? 1 : 0);
    const barAlpha = lerp(show(this.focusFrom), show(this.focusTo), p);
    if (barAlpha <= 0) return 0;
    const ctx = this.ctx;
    const maxW = W * 0.86;
    const font = (s: number) => `700 ${s}px ${this.fonts.display}`;
    ctx.save();
    ctx.globalAlpha = barAlpha;
    ctx.fillStyle = BRAND.red;
    ctx.fillRect(W / 2 - 60, H * 0.035, 120, 6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = BRAND.white;
    // Crossfade old → new question text.
    const texts: [string | null, number][] =
      this.focusFrom === this.focusTo ? [[this.focusTo, 1]] : [[this.focusFrom, 1 - p], [this.focusTo, p]];
    for (const [qid, a] of texts) {
      const question = qid ? QUESTIONS.find((x) => x.id === qid) : undefined;
      if (!question || a <= 0) continue;
      const size = fitFontSize(ctx, question.text, font, maxW, 46, 28);
      ctx.globalAlpha = a;
      ctx.font = font(size);
      ctx.fillText(ellipsize(ctx, question.text, maxW), W / 2, H * 0.075);
    }
    ctx.restore();
    return barAlpha;
  }

  stats(): DebugStats {
    return {
      fps: this.fps,
      'drawn fps': this.drawFps,
      responses: this.agg.respondents,
      words: this.current.length,
      heroes: this.current.filter((w) => w.layer === 'hero').length,
      'layout ms': this.lastLayoutMs,
      'flying words': this.flyers.length,
      'outline lights': this.outline.length,
      worker: this.worker ? 'yes' : 'no (main thread)',
      focus: this.focusTo ?? 'all',
      mode: this.control.mode,
      epoch: this.control.epoch,
      stage: `${W}×${H} @${Math.min(2, window.devicePixelRatio || 1)}x`,
    };
  }
}
