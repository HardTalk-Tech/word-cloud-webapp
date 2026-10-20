// Interpolate between two cloud layouts (pure). Words match by key; unmatched fade in/out.
import { lerp, lerpColor } from '@/lib/anim';
import type { PlacedWord } from './layout';

export type FrameWord = PlacedWord & { alpha: number };

export type Transition = {
  sample: (t: number) => FrameWord[];
};

export function createTransition(prev: PlacedWord[], next: PlacedWord[]): Transition {
  const prevByKey = new Map(prev.map((p) => [p.key, p]));
  const nextKeys = new Set(next.map((n) => n.key));
  const pairs = next.map((n) => ({ from: prevByKey.get(n.key) ?? null, to: n }));
  const leaving = prev.filter((p) => !nextKeys.has(p.key));

  return {
    sample(t) {
      const out: FrameWord[] = [];
      for (const p of leaving) out.push({ ...p, alpha: 1 - t });
      for (const { from, to } of pairs) {
        if (!from) {
          out.push({ ...to, alpha: t });
          continue;
        }
        if (from.rotate !== to.rotate || from.font !== to.font || from.text !== to.text) {
          // Rotation / font switches crossfade instead of morphing.
          out.push({ ...from, key: `${from.key}~out`, alpha: 1 - t });
          out.push({ ...to, alpha: t });
          continue;
        }
        out.push({
          ...to,
          x: lerp(from.x, to.x, t),
          y: lerp(from.y, to.y, t),
          size: lerp(from.size, to.size, t),
          opacity: lerp(from.opacity, to.opacity, t),
          color: lerpColor(from.color, to.color, t),
          alpha: 1,
        });
      }
      // Draw order: filler under heroes, small under big.
      out.sort((a, b) => (a.layer === b.layer ? a.size - b.size : a.layer === 'filler' ? -1 : 1));
      return out;
    },
  };
}
