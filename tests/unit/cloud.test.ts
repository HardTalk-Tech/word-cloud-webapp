import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { aggregate, bucketedCountsKey, optionKey } from '@/lib/cloud/aggregate';
import {
  DEFAULT_LAYOUT,
  layoutCloud,
  placedBox,
  tierForRank,
  widthKey,
  wordText,
  type CloudWord,
} from '@/lib/cloud/layout';
import { createTransition } from '@/lib/cloud/tween';
import { isInside, maskFromAlpha, type MaskGrid } from '@/lib/mask/mask';
import { outlineDots } from '@/lib/mask/outline';
import { CLOUD_PALETTE } from '@/config/brand';
import { QUESTIONS } from '@/config/questions';
import { STAGE } from '@/config/stage';

let mask: MaskGrid;

beforeAll(async () => {
  const file = path.join(process.cwd(), 'public', 'brand', 'crown-mask.png');
  const { data, info } = await sharp(file)
    .resize(STAGE.width, STAGE.height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  mask = maskFromAlpha(new Uint8ClampedArray(data), info.width, info.height, 3);
});

describe('mask', () => {
  it('marks crown inside and corners outside', () => {
    expect(mask.insideCount).toBeGreaterThan(1000);
    expect(isInside(mask, STAGE.width / 2, STAGE.height * 0.6)).toBe(true);
    expect(isInside(mask, 5, 5)).toBe(false);
    expect(isInside(mask, STAGE.width - 5, STAGE.height - 5)).toBe(false);
    // Between the left and centre spikes near the top: outside.
    expect(isInside(mask, STAGE.width * 0.2, STAGE.height * 0.12)).toBe(false);
  });
});

describe('aggregate', () => {
  it('counts per option and per question, ignoring unknown ids and duplicates', () => {
    const agg = aggregate(
      [
        { answers: { q1: ['a', 'b'], q2: ['c'] } },
        { answers: { q1: ['a', 'a', 'zzz'] } },
        { answers: { nope: ['a'] } },
      ],
      QUESTIONS,
    );
    expect(agg.respondents).toBe(2);
    expect(agg.byOption.get(optionKey('q1', 'a'))).toBe(2);
    expect(agg.byOption.get(optionKey('q1', 'b'))).toBe(1);
    expect(agg.byOption.get(optionKey('q2', 'c'))).toBe(1);
    expect(agg.byOption.get(optionKey('q3', 'a'))).toBe(0);
    expect(agg.byQuestion.get('q1')!.respondents).toBe(2);
    expect(agg.byQuestion.get('q2')!.respondents).toBe(1);
  });

  it('bucketed key is stable for small changes', () => {
    const a = new Map([['q1:a', 40], ['q1:b', 3]]);
    const b = new Map([['q1:a', 41], ['q1:b', 3]]);
    expect(bucketedCountsKey(a)).toBe(bucketedCountsKey(b));
  });
});

function words(counts: (i: number) => number): CloudWord[] {
  return QUESTIONS.flatMap((q) =>
    q.options.map((o, i) => ({ key: optionKey(q.id, o.id), label: o.label, questionId: q.id, count: counts(i) })),
  );
}

// Approximate widths per 1px: heavy sans uppercase is wide, the serif in title case narrower.
const widths = Object.fromEntries(
  QUESTIONS.flatMap((q) =>
    q.options.flatMap((o) => [
      [widthKey('sans', wordText('sans', o.label)), o.label.length * 0.78],
      [widthKey('serif', wordText('serif', o.label)), o.label.length * 0.5],
    ]),
  ),
);

describe('layoutCloud', () => {
  const input = words((i) => 120 - i * 17);
  const opts = { ...DEFAULT_LAYOUT, seed: 'test' };

  it('places every hero once, inside the mask, with no overlaps', () => {
    const placed = layoutCloud(mask, input, widths, opts);
    const heroes = placed.filter((p) => p.layer === 'hero');
    expect(new Set(heroes.map((h) => h.key)).size).toBe(heroes.length);
    expect(heroes.length).toBe(input.length);
    expect(placed.filter((p) => p.layer === 'filler').length).toBeGreaterThan(50);

    const grid = new Uint8Array(mask.cols * mask.rows);
    for (const p of placed) {
      const b = placedBox(p, widths, mask.cell);
      for (let r = b.top; r < b.top + b.h; r++) {
        for (let c = b.left; c < b.left + b.w; c++) {
          const i = r * mask.cols + c;
          expect(mask.inside[i]).toBe(1);
          expect(grid[i]).toBe(0);
          grid[i] = 1;
        }
      }
    }
  });

  it('is deterministic for the same seed', () => {
    expect(layoutCloud(mask, input, widths, opts)).toEqual(layoutCloud(mask, input, widths, opts));
  });

  it('runs under 400 ms for 30 heroes + filler', () => {
    const t0 = performance.now();
    layoutCloud(mask, input, widths, { ...opts, seed: 'perf' });
    expect(performance.now() - t0).toBeLessThan(400);
  });

  it('empty state: filler only', () => {
    const placed = layoutCloud(mask, words(() => 0), widths, opts);
    expect(placed.every((p) => p.layer === 'filler')).toBe(true);
    expect(placed.length).toBeGreaterThan(30);
  });

  it('final mode: heroes only', () => {
    const placed = layoutCloud(mask, input, widths, { ...opts, includeFiller: false });
    expect(placed.every((p) => p.layer === 'hero')).toBe(true);
  });

  it('colours heroes by rank tier; filler is faint deep red; serif words are title case', () => {
    expect([0, 2, 3, 9, 10, 17, 18, 27].map((r) => tierForRank(r, 5))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(tierForRank(0, 0)).toBe(3);

    const placed = layoutCloud(mask, input, widths, opts);
    const heroes = placed.filter((p) => p.layer === 'hero');
    expect(heroes.filter((h) => h.tier === 0)).toHaveLength(3);
    for (const h of heroes) expect(h.color).toBe(CLOUD_PALETTE.tiers[h.tier as 0 | 1 | 2 | 3]);
    for (const f of placed.filter((p) => p.layer === 'filler')) {
      expect(f.tier).toBe(4);
      expect(f.font).toBe('sans');
      expect(f.opacity).toBeLessThan(0.6);
      expect(CLOUD_PALETTE.filler as readonly string[]).toContain(f.color);
    }
    for (const w of placed) {
      if (w.font === 'serif') {
        expect([1, 2]).toContain(w.tier);
        expect(w.text).not.toBe(w.text.toUpperCase());
      } else {
        expect(w.text).toBe(w.text.toUpperCase());
      }
    }
  });
});

describe('outlineDots', () => {
  it('places evenly spaced lights just outside the crown edge', () => {
    const spacing = 20;
    const dots = outlineDots(mask, 4, spacing);
    expect(dots.length).toBeGreaterThan(40);
    for (const d of dots) {
      expect(isInside(mask, d.x, d.y)).toBe(false);
      // Within ~offset of the silhouette: some inside cell nearby.
      const near = [-15, 0, 15].some((dx) => [-15, 0, 15].some((dy) => isInside(mask, d.x + dx, d.y + dy)));
      expect(near).toBe(true);
    }
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        expect(Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y)).toBeGreaterThanOrEqual(spacing - 0.001);
      }
    }
  });
});

describe('tween', () => {
  it('interpolates matched words and fades unmatched', () => {
    const base = {
      optionKey: 'k',
      text: 'A',
      questionId: 'q1',
      rotate: 0 as const,
      color: '#ffffff',
      opacity: 1,
      layer: 'hero' as const,
      tier: 0 as const,
      font: 'sans' as const,
    };
    const prev = [
      { ...base, key: 'a', x: 0, y: 0, size: 10 },
      { ...base, key: 'gone', x: 0, y: 0, size: 10 },
    ];
    const next = [
      { ...base, key: 'a', x: 100, y: 50, size: 30 },
      { ...base, key: 'new', x: 5, y: 5, size: 10 },
    ];
    const mid = createTransition(prev, next).sample(0.5);
    const a = mid.find((w) => w.key === 'a')!;
    expect(a.x).toBe(50);
    expect(a.size).toBe(20);
    expect(mid.find((w) => w.key === 'gone')!.alpha).toBe(0.5);
    expect(mid.find((w) => w.key === 'new')!.alpha).toBe(0.5);
  });
});
