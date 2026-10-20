// Welcome spotlight: dimmed/blurred wall snapshot, light-beam burst, photo card(s) and a frosted
// name panel; then FLIP fly into the wall slot.
import confetti from 'canvas-confetti';
import { BRAND, COPY } from '@/config/brand';
import { STAGE } from '@/config/stage';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, lerp, lerpRect, type Rect } from '@/lib/anim';
import type { FontFamilies } from '@/lib/fonts';
import type { Phase } from '@/lib/wall/queue';
import { ellipsize, fitFontSize, roundRectPath } from '@/components/stage/canvas';

export type SpotPerson = {
  id: string;
  name: string;
  department: string;
  img: CanvasImageSource | null;
  target: Rect | null;
};

const W = STAGE.width;
const H = STAGE.height;

type CardLayout = {
  photos: Rect[];
  /** Frosted panel behind "Welcome" + names. */
  panel: Rect;
  welcomeY: number;
  nameY: number;
  deptY: number;
  nameMax: number;
  deptMax: number;
  nameMaxWidth: number;
  single: boolean;
};

export function cardLayout(n: number): CardLayout {
  if (n <= 1) {
    const side = Math.round(H * 0.5);
    const top = Math.round(H * 0.06);
    const panelTop = top + side + H * 0.035;
    return {
      photos: [{ x: (W - side) / 2, y: top, w: side, h: side }],
      panel: { x: W * 0.07, y: panelTop, w: W * 0.86, h: H * 0.33 },
      welcomeY: panelTop + H * 0.065,
      nameY: panelTop + H * 0.165,
      deptY: panelTop + H * 0.26,
      nameMax: 118,
      deptMax: 50,
      nameMaxWidth: W * 0.8,
      single: true,
    };
  }
  const gap = 36;
  const side = Math.floor(Math.min(H * 0.4, (W * 0.92 - gap * (n - 1)) / n));
  const rowW = side * n + gap * (n - 1);
  const top = Math.round(H * 0.47 - side / 2);
  const panelTop = top + side + H * 0.03;
  return {
    photos: Array.from({ length: n }, (_, i) => ({ x: (W - rowW) / 2 + i * (side + gap), y: top, w: side, h: side })),
    panel: { x: (W - rowW) / 2 - 24, y: panelTop, w: rowW + 48, h: H * 0.17 },
    welcomeY: top - H * 0.09,
    nameY: panelTop + H * 0.06,
    deptY: panelTop + H * 0.12,
    nameMax: n === 2 ? 70 : 54,
    deptMax: n === 2 ? 36 : 28,
    nameMaxWidth: side + gap * 0.6,
    single: false,
  };
}

/** Radial burst of soft light rays (pre-rendered once, rotated slowly behind the photo). */
function makeBeams(): HTMLCanvasElement {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const rays = 22;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const spread = (i % 2 ? 0.05 : 0.085) * Math.PI;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    const strong = i % 3 === 0;
    g.addColorStop(0, `rgba(255,${strong ? 170 : 90},${strong ? 180 : 105},${strong ? 0.55 : 0.4})`);
    g.addColorStop(0.55, 'rgba(210,40,60,0.18)');
    g.addColorStop(1, 'rgba(172,31,45,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, cx, a - spread / 2, a + spread / 2);
    ctx.closePath();
    ctx.fill();
  }
  // Bright core.
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.45);
  core.addColorStop(0, 'rgba(255,200,205,0.5)');
  core.addColorStop(1, 'rgba(255,200,205,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export class SpotlightRenderer {
  private snapshot: HTMLCanvasElement | null = null;
  private fire: confetti.CreateTypes | null = null;
  private readonly beams = makeBeams();

  constructor(
    private readonly fonts: FontFamilies,
    confettiCanvas: HTMLCanvasElement | null,
  ) {
    if (confettiCanvas) {
      confettiCanvas.width = W;
      confettiCanvas.height = H;
      this.fire = confetti.create(confettiCanvas, { resize: false, useWorker: false, disableForReducedMotion: false });
    }
  }

  /** Blur + dim the current wall once per spotlight (never per frame). */
  takeSnapshot(source: HTMLCanvasElement) {
    const c = this.snapshot ?? document.createElement('canvas');
    c.width = Math.round(W / 2);
    c.height = Math.round(H / 2);
    const ctx = c.getContext('2d')!;
    ctx.filter = 'blur(5px)';
    ctx.drawImage(source, 0, 0, c.width, c.height);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(11,11,13,0.65)';
    ctx.fillRect(0, 0, c.width, c.height);
    this.snapshot = c;
  }

  burst() {
    const fire = this.fire;
    if (!fire) return;
    const colors = [...BRAND.confetti];
    const base = { colors, ticks: 220, gravity: 0.9, scalar: 1.6, startVelocity: 55 };
    void fire({ ...base, particleCount: 90, spread: 70, angle: 60, origin: { x: 0, y: 0.75 } });
    void fire({ ...base, particleCount: 90, spread: 70, angle: 120, origin: { x: 1, y: 0.75 } });
    void fire({ ...base, particleCount: 60, spread: 110, startVelocity: 40, origin: { x: 0.5, y: 0.35 } });
  }

  reset() {
    this.fire?.reset();
  }

  /** p = progress of the current phase (0..1). */
  draw(ctx: CanvasRenderingContext2D, phase: Phase, p: number, people: SpotPerson[], now = performance.now()) {
    if (phase === 'WALL_IDLE' || people.length === 0) return;
    const overlay = phase === 'SPOT_IN' ? easeOutCubic(p) : phase === 'SPOT_HOLD' ? 1 : 1 - easeInOutCubic(p);
    if (this.snapshot && overlay > 0) {
      ctx.save();
      ctx.globalAlpha = overlay;
      ctx.drawImage(this.snapshot, 0, 0, W, H);
      ctx.restore();
    }

    const layout = cardLayout(people.length);
    const appear = phase === 'SPOT_IN' ? p : 1;
    const flyT = phase === 'SPOT_FLY' ? easeInOutCubic(p) : 0;
    const textAlpha = phase === 'SPOT_IN' ? clamp((p - 0.3) / 0.7, 0, 1) : phase === 'SPOT_FLY' ? clamp(1 - p * 3, 0, 1) : 1;

    // Light-beam burst behind the photo(s), slowly turning.
    const beamAlpha = phase === 'SPOT_IN' ? easeOutCubic(p) : phase === 'SPOT_HOLD' ? 1 : clamp(1 - p * 2, 0, 1);
    if (beamAlpha > 0) {
      const first = layout.photos[0];
      const last = layout.photos[layout.photos.length - 1];
      const cx = (first.x + last.x + last.w) / 2;
      const cy = first.y + first.h / 2;
      const size = Math.max(last.x + last.w - first.x, first.h) * (2.1 + 0.15 * appear);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85 * beamAlpha;
      ctx.translate(cx, cy);
      ctx.rotate((now / 1000) * 0.12);
      ctx.drawImage(this.beams, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    // Frosted panel behind the text (the blurred wall shows through it).
    if (textAlpha > 0) {
      const pnl = layout.panel;
      const lift = (1 - appear) * 24;
      ctx.save();
      ctx.globalAlpha = textAlpha;
      roundRectPath(ctx, pnl.x, pnl.y + lift, pnl.w, pnl.h, 28);
      const g = ctx.createLinearGradient(0, pnl.y, 0, pnl.y + pnl.h);
      g.addColorStop(0, 'rgba(40,14,20,0.72)');
      g.addColorStop(1, 'rgba(14,8,10,0.78)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.stroke();
      // Red accent bar on top.
      ctx.fillStyle = BRAND.red;
      ctx.fillRect(W / 2 - 70, pnl.y + lift - 3, 140, 6);
      ctx.restore();

      // "Welcome"
      ctx.save();
      ctx.globalAlpha = textAlpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = BRAND.greyLight;
      ctx.font = `600 ${layout.single ? 78 : 70}px ${this.fonts.serif}`;
      ctx.fillText(COPY.welcome, W / 2, layout.welcomeY + (1 - appear) * 20);
      ctx.restore();
    }

    people.forEach((person, i) => {
      const card = layout.photos[i];
      let rect: Rect;
      if (phase === 'SPOT_IN') {
        const s = lerp(0.82, 1, easeOutBack(p));
        rect = { x: card.x + (card.w * (1 - s)) / 2, y: card.y + (card.h * (1 - s)) / 2 + (1 - p) * 30, w: card.w * s, h: card.h * s };
      } else if (phase === 'SPOT_FLY' && person.target) {
        rect = lerpRect(card, person.target, flyT);
      } else {
        rect = card;
      }
      const radius = lerp(card.w * 0.06, 2, flyT);
      const ringAlpha = phase === 'SPOT_FLY' ? 1 - flyT : appear;

      ctx.save();
      ctx.globalAlpha = phase === 'SPOT_IN' ? clamp(p * 1.6, 0, 1) : 1;
      // Red accent ring with a soft glow (stacked strokes; no per-frame shadowBlur).
      if (ringAlpha > 0) {
        ctx.save();
        const baseAlpha = ctx.globalAlpha * ringAlpha;
        const ring = Math.max(6, rect.w * 0.018);
        roundRectPath(ctx, rect.x - ring * 1.6, rect.y - ring * 1.6, rect.w + ring * 3.2, rect.h + ring * 3.2, radius + ring * 1.6);
        ctx.strokeStyle = BRAND.red;
        for (const [width, alpha] of [
          [ring * 7, 0.06],
          [ring * 4.5, 0.1],
          [ring * 2.5, 0.18],
          [ring, 1],
        ] as const) {
          ctx.globalAlpha = baseAlpha * alpha;
          ctx.lineWidth = width;
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.save();
      roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
      ctx.clip();
      if (person.img) ctx.drawImage(person.img, rect.x, rect.y, rect.w, rect.h);
      else {
        ctx.fillStyle = BRAND.surfaceRaised;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
      ctx.restore();
      ctx.restore();

      if (textAlpha > 0) {
        const cx = card.x + card.w / 2;
        const lift = (1 - appear) * 24;
        // Name, auto-fit to width.
        const nameFont = (size: number) => `800 ${size}px ${this.fonts.display}`;
        const nameSize = fitFontSize(ctx, person.name, nameFont, layout.nameMaxWidth, layout.nameMax, layout.single ? 48 : 28);
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = nameFont(nameSize);
        ctx.fillStyle = BRAND.white;
        ctx.fillText(ellipsize(ctx, person.name, layout.nameMaxWidth), cx, layout.nameY + lift);
        // Department, smaller, in rose.
        if (person.department) {
          const deptFont = (size: number) => `600 ${size}px ${this.fonts.display}`;
          const deptSize = fitFontSize(ctx, person.department, deptFont, layout.nameMaxWidth, layout.deptMax, 22);
          ctx.font = deptFont(deptSize);
          ctx.fillStyle = '#FF9AA6';
          ctx.fillText(ellipsize(ctx, person.department, layout.nameMaxWidth), cx, layout.deptY + lift);
        }
        ctx.restore();
      }
    });
  }
}
