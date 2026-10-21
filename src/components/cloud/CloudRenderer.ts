// Screen 2 engine: responses → counts → masked layout (worker) → tween → canvas.
import { BRAND, CLOUD_PALETTE } from '@/config/brand';
import { QUESTIONS } from '@/config/questions';
import { STAGE } from '@/config/stage';
import { CLOUD } from '@/config/timings';
import { clamp, easeInOutCubic, lerp, progress, type Rect } from '@/lib/anim';
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
import { createTransition, type FrameWord, type Transition } from '@/lib/cloud/tween';
import { ensureFonts, fontFamilies, type FontFamilies } from '@/lib/fonts';
import { loadMask, type LoadedMask } from '@/lib/mask/mask';
import { outlineDots, type OutlineDot } from '@/lib/mask/outline';
import { hashString } from '@/lib/random';
import { DEFAULT_CONTROL, type ControlState, type ResponseDoc } from '@/types/models';
import {
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
const CROWN_BOX: Rect = { x: W * 0.02, y: H * 0.105, w: W * 0.96, h: H * 0.75 };
const WORDMARK_Y = H * 0.915;
const MASK_CELL = 3;
const TAU = Math.PI * 2;
/** Outline lights: distance outside the crown edge (cells) and spacing (stage px). */
const OUTLINE_OFFSET_CELLS = 4;
const OUTLINE_SPACING = 20;
/** Baseline offset from the word box centre, × font size. */
const BASELINE: Record<WordFont, number> = { sans: BOX_HEIGHT.sans * 0.45, serif: 0.3 };

type Flyer = { key: string; text: string; start: number; from: { x: number; y: number }; bend: number };

/** Stable 0..1 per key, so each word twinkles / breathes on its own rhythm. */
function phaseOf(key: string): number {
  return (parseInt(hashString(key), 36) % 1000) / 1000;
}

export class CloudRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fonts: FontFamilies;
  private mask: LoadedMask | null = null;
  private brand: BrandImages = { crown: null, wordmark: null };
  private widths: Record<string, number> | null = null;
  private outline: OutlineDot[] = [];
  private readonly outlineSprite: HTMLCanvasElement;
  private readonly sparkSprite: HTMLCanvasElement;
  private readonly phases = new Map<string, number>();

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

  /** A chosen word rises from the bottom and joins the crown; its hero pulses on arrival. */
  private spawnFlyer(key: string, now: number) {
    if (this.flyers.length >= CLOUD.maxFlyers) {
      this.pulses.set(key, now);
      return;
    }
    const [qid, oid] = key.split(':');
    const label = QUESTIONS.find((q) => q.id === qid)?.options.find((o) => o.id === oid)?.label ?? '';
    // Stagger + spread so a multi-select answer arrives as a little stream, not one blob.
    const lane = this.flyers.length;
    this.flyers.push({
      key,
      text: label.toUpperCase(),
      start: now + lane * 220,
      from: { x: W * (0.2 + ((lane * 0.37 + Math.random() * 0.15) % 0.6)), y: H + 30 },
      bend: (Math.random() - 0.5) * W * 0.5,
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
    let fast = this.flyers.length > 0;
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
    this.drawFlyers(now);

    this.drawBanner(now);
    drawWordmark(ctx, {
      x: W / 2,
      y: WORDMARK_Y - fin * 6,
      // Wordmark only: the cloud above it is the crown.
      height: 52 + 16 * fin,
      align: 'center',
      fonts: this.fonts,
      brand: this.brand,
      crown: false,
    });
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
      ctx.font =
        w.font === 'serif' ? `700 ${size.toFixed(1)}px ${this.fonts.serif}` : `800 ${size.toFixed(1)}px ${this.fonts.display}`;
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
    // Fly to the option's big word; if it isn't one (outside the top options), to one of its small copies.
    const heroPos = new Map<string, { x: number; y: number }>();
    for (const w of this.frameWords) if (w.layer === 'filler' && w.alpha > 0.5) heroPos.set(w.optionKey, w);
    for (const w of this.frameWords) if (w.layer === 'hero' && w.alpha > 0.5) heroPos.set(w.optionKey, w);
    const fallback = this.mask
      ? { x: this.mask.rect.x + this.mask.rect.w / 2, y: this.mask.rect.y + this.mask.rect.h * 0.6 }
      : { x: W / 2, y: H / 2 };

    const at = (f: Flyer, to: { x: number; y: number }, p: number) => {
      const c = { x: (f.from.x + to.x) / 2 + f.bend, y: Math.min(f.from.y, to.y) - H * 0.12 };
      const u = 1 - p;
      return {
        x: u * u * f.from.x + 2 * u * p * c.x + p * p * to.x,
        y: u * u * f.from.y + 2 * u * p * c.y + p * p * to.y,
      };
    };

    const done: Flyer[] = [];
    ctx.save();
    for (const f of this.flyers) {
      const raw = (now - f.start) / CLOUD.flyMs;
      if (raw < 0) continue;
      if (raw >= 1) {
        done.push(f);
        continue;
      }
      const to = heroPos.get(f.key) ?? fallback;
      const p = easeInOutCubic(raw);
      // Spark with a short fading trail.
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 5; k >= 0; k--) {
        const pos = at(f, to, Math.max(0, p - k * 0.035));
        const r = 14 - k * 2;
        ctx.globalAlpha = (1 - k / 6) * 0.9;
        ctx.drawImage(this.sparkSprite, pos.x - r, pos.y - r, r * 2, r * 2);
      }
      // The word itself rides along and fades as it lands.
      const head = at(f, to, p);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = raw < 0.7 ? 1 : (1 - raw) / 0.3;
      ctx.font = `800 24px ${this.fonts.display}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = BRAND.white;
      ctx.fillText(f.text, head.x, head.y + 14);
    }
    ctx.restore();
    if (done.length) {
      for (const f of done) this.pulses.set(f.key, now);
      this.flyers = this.flyers.filter((f) => !done.includes(f));
    }
  }

  private drawBanner(now: number) {
    const p = easeInOutCubic(progress(now, this.focusAt, CLOUD.focusTweenMs));
    const show = (q: string | null) => (q ? 1 : 0);
    const barAlpha = lerp(show(this.focusFrom), show(this.focusTo), p);
    if (barAlpha <= 0) return;
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
