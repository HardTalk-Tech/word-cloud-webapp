// LED-wall background: coloured glow, soft vertical light beams and glowing bokeh dots (colours from the
// screen theme). Everything heavy (gradients, blurred sprites) is pre-rendered once; each frame only blits
// sprites with a slowly changing alpha, so it costs a few hundred cheap drawImage calls.
import { BACKGROUND, type BackgroundVariant } from '@/config/background';
import type { ScreenTheme } from '@/config/themes';
import { rng } from '@/lib/random';
import { setupCanvas } from './canvas';

type Beam = { x: number; width: number; height: number; alpha: number; speed: number; phase: number };
type Dot = { x: number; y: number; r: number; alpha: number; speed: number; phase: number; drift: number; sprite: number };

const TAU = Math.PI * 2;

/** While a screen is busy with a big animation (e.g. the welcome spotlight) the background holds still. */
let paused = false;

/** Freeze / resume every background on the page (it keeps its last frame; nothing is redrawn while paused). */
export function setBackgroundPaused(value: boolean) {
  paused = value;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Soft round light: bright core fading to transparent. */
function dotSprite(color: string, size = 64): HTMLCanvasElement {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Vertical light beam: bright at the top, fading down; soft on both sides. */
function beamSprite(rgb: readonly [number, number, number]): HTMLCanvasElement {
  const w = 64;
  const h = 512;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const [r, g, b] = rgb;
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, `rgba(${r},${g},${b},1)`);
  v.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`);
  v.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // Feather the sides.
  ctx.globalCompositeOperation = 'destination-in';
  const side = ctx.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.5, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export class BackgroundRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly beam: HTMLCanvasElement;
  private readonly sprites: HTMLCanvasElement[];
  private readonly beams: Beam[] = [];
  private readonly dots: Dot[] = [];
  private readonly intensity: number;
  private raf = 0;
  private last = 0;
  private destroyed = false;

  constructor(
    target: HTMLCanvasElement,
    private readonly w: number,
    private readonly h: number,
    variant: BackgroundVariant,
    theme: ScreenTheme,
  ) {
    this.ctx = setupCanvas(target, w, h);
    const v = BACKGROUND.variants[variant];
    const c = theme.background;
    const [pr, pg, pb] = c.pool;
    this.intensity = v.intensity;
    const random = rng(`${BACKGROUND.seed}:${variant}`);

    // Base: deep coloured glow from the top centre into near-black.
    this.base = canvas(w, h);
    const b = this.base.getContext('2d')!;
    b.fillStyle = c.base;
    b.fillRect(0, 0, w, h);
    const glow = b.createRadialGradient(w / 2, -h * 0.1, 0, w / 2, -h * 0.1, h * 1.15);
    glow.addColorStop(0, c.glow);
    glow.addColorStop(0.45, c.mid);
    glow.addColorStop(1, c.base);
    b.globalAlpha = 0.55 + 0.45 * v.intensity;
    b.fillStyle = glow;
    b.fillRect(0, 0, w, h);
    // Warm floor glow behind the bokeh rows.
    const floor = b.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, w * 0.7);
    floor.addColorStop(0, c.glow);
    floor.addColorStop(1, 'rgba(0,0,0,0)');
    b.globalAlpha = 0.7 * v.intensity;
    b.fillStyle = floor;
    b.fillRect(0, 0, w, h);
    b.globalAlpha = 1;

    // Overlay (drawn last): vignette, plus a dark pool behind the crown on the cloud screen.
    this.overlay = canvas(w, h);
    const o = this.overlay.getContext('2d')!;
    const vignette = o.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
    o.fillStyle = vignette;
    o.fillRect(0, 0, w, h);
    if (v.centerDarken > 0) {
      const pool = o.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.55);
      pool.addColorStop(0, `rgba(${pr},${pg},${pb},${v.centerDarken})`);
      pool.addColorStop(0.7, `rgba(${pr},${pg},${pb},${v.centerDarken * 0.6})`);
      pool.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
      o.fillStyle = pool;
      o.fillRect(0, 0, w, h);
    }

    this.beam = beamSprite(c.beam);
    this.sprites = c.dots.map((col) => dotSprite(col));

    // Light beams across the top, like stage lights.
    for (let i = 0; i < v.beams; i++) {
      const x = ((i + 0.5) / v.beams) * w + (random() - 0.5) * (w / v.beams) * 0.8;
      this.beams.push({
        x,
        width: 30 + random() * 80,
        height: h * (0.35 + random() * 0.5),
        alpha: 0.05 + random() * 0.1,
        speed: 0.15 + random() * 0.35,
        phase: random() * TAU,
      });
    }

    // Small lights running down some beams (the dotted streaks).
    for (let i = 0; i < v.beamDots; i++) {
      const beam = this.beams[Math.floor(random() * this.beams.length)];
      const y = Math.pow(random(), 1.4) * beam.height * 0.9;
      this.dots.push({
        x: beam.x + (random() - 0.5) * beam.width * 0.3,
        y,
        r: 3 + random() * 5,
        alpha: (0.25 + random() * 0.45) * (1 - y / beam.height),
        speed: 0.6 + random() * 1.4,
        phase: random() * TAU,
        drift: 0,
        sprite: Math.floor(random() * this.sprites.length),
      });
    }

    // Bokeh floor: rows of soft lights in perspective, curving like a wave.
    for (let row = 0; row < v.floorRows; row++) {
      const t = row / Math.max(1, v.floorRows - 1); // 0 = far, 1 = near
      const r = 6 + t * 22;
      const spacing = r * 2.6;
      const baseY = h * (0.8 + t * 0.2);
      const count = Math.ceil(w / spacing) + 2;
      for (let k = 0; k < count; k++) {
        const x = k * spacing + (random() - 0.5) * spacing * 0.5 + (row % 2) * spacing * 0.5 - spacing;
        const wave = Math.sin((x / w) * TAU * 0.9 + row * 0.7) * h * 0.025;
        // Brighter towards the centre, fading at the sides.
        const centre = 1 - Math.abs(x / w - 0.5) * 1.4;
        this.dots.push({
          x,
          y: baseY + wave + (random() - 0.5) * r,
          r: r * (0.7 + random() * 0.6),
          alpha: Math.max(0, centre) * (0.25 + random() * 0.4) * (0.5 + t * 0.5),
          speed: 0.3 + random() * 0.8,
          phase: random() * TAU,
          drift: 4 + random() * 10,
          sprite: Math.floor(random() * this.sprites.length),
        });
      }
    }
    // Drop lights too faint to see (mostly the far sides of the bokeh floor): fewer draws, same picture.
    const visible = this.dots.filter((d) => d.alpha * this.intensity >= BACKGROUND.minDotAlpha);
    this.dots.length = 0;
    this.dots.push(...visible);
  }

  start() {
    this.draw(performance.now());
    if (!BACKGROUND.animate) return;
    const frameMs = 1000 / BACKGROUND.fps;
    const loop = (now: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      if (paused || now - this.last < frameMs) return;
      this.last = now;
      this.draw(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  private draw(now: number) {
    const ctx = this.ctx;
    const t = now / 1000;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.base, 0, 0, this.w, this.h);

    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beams) {
      ctx.globalAlpha = b.alpha * this.intensity * (0.6 + 0.4 * Math.sin(t * b.speed + b.phase));
      ctx.drawImage(this.beam, b.x - b.width / 2, -4, b.width, b.height);
    }
    for (const d of this.dots) {
      const a = d.alpha * this.intensity * (0.55 + 0.45 * Math.sin(t * d.speed + d.phase));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const x = d.x + Math.sin(t * 0.12 + d.phase) * d.drift;
      const size = d.r * 2;
      ctx.drawImage(this.sprites[d.sprite], x - d.r, d.y - d.r, size, size);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.overlay, 0, 0, this.w, this.h);
  }
}
