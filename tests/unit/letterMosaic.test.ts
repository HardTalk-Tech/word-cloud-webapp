import { describe, expect, it } from 'vitest';
import { buildLetterMosaic, pickSource, type Glyph } from '@/lib/cloud/letterMosaic';

/** 60×40 image: grey block top-left, teal block bottom-right, transparent elsewhere. */
function image() {
  const w = 60;
  const h = 40;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x < 20 && y < 20) rgba.set([0xb3, 0xb5, 0xb8, 255], i);
      else if (x >= 40 && y >= 20) rgba.set([0x11, 0xb9, 0xa8, 255], i);
    }
  }
  return { rgba, w, h };
}

const opts = { cell: 5, seed: 'test', jitter: 0 };

describe('buildLetterMosaic', () => {
  it('puts letters only on ink, in the right tone', () => {
    const { rgba, w, h } = image();
    const glyphs = buildLetterMosaic(rgba, w, h, { x: 100, y: 200 }, opts);
    // 4×4 cells per 20×20 block.
    expect(glyphs).toHaveLength(32);
    for (const g of glyphs) {
      const lx = g.x - 100;
      const ly = g.y - 200;
      if (lx < 20 && ly < 20) expect(g.tone).toBe('name');
      else {
        expect(lx).toBeGreaterThanOrEqual(40);
        expect(ly).toBeGreaterThanOrEqual(20);
        expect(g.tone).toBe('health');
      }
    }
  });

  it('uses only capital letters and is deterministic for a seed', () => {
    const { rgba, w, h } = image();
    const a = buildLetterMosaic(rgba, w, h, { x: 0, y: 0 }, opts);
    const b = buildLetterMosaic(rgba, w, h, { x: 0, y: 0 }, opts);
    expect(a).toEqual(b);
    for (const g of a) expect(g.char).toMatch(/^[A-Z]$/);
  });

  it('keeps jittered letters near their cell', () => {
    const { rgba, w, h } = image();
    const glyphs = buildLetterMosaic(rgba, w, h, { x: 0, y: 0 }, { cell: 5, seed: 's', jitter: 0.2 });
    for (const g of glyphs) {
      const inGrey = g.x < 21 && g.y < 21;
      const inTeal = g.x > 39 && g.y > 19;
      expect(inGrey || inTeal).toBe(true);
    }
  });
});

describe('keep / coverage', () => {
  it('keep < 1 leaves some inked cells empty, the same ones for a seed', () => {
    const { rgba, w, h } = image();
    const all = buildLetterMosaic(rgba, w, h, { x: 0, y: 0 }, opts);
    const some = buildLetterMosaic(rgba, w, h, { x: 0, y: 0 }, { ...opts, keep: 0.5 });
    expect(some.length).toBeGreaterThan(0);
    expect(some.length).toBeLessThan(all.length);
    expect(buildLetterMosaic(rgba, w, h, { x: 0, y: 0 }, { ...opts, keep: 0.5 })).toEqual(some);
  });

  it('a stroke thinner than the coverage needs gets no letter', () => {
    // 1px-wide vertical line in a 10×10 image: 10% of a 10px cell.
    const rgba = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 0; y < 10; y++) rgba.set([200, 200, 200, 255], (y * 10 + 5) * 4);
    expect(buildLetterMosaic(rgba, 10, 10, { x: 0, y: 0 }, { cell: 10, seed: 's', coverage: 0.6 })).toHaveLength(0);
    expect(buildLetterMosaic(rgba, 10, 10, { x: 0, y: 0 }, { cell: 10, seed: 's', coverage: 0.05 })).toHaveLength(1);
  });
});

describe('pickSource', () => {
  const glyphs: Glyph[] = ['A', 'B', 'C', 'B'].map((char, i) => ({ x: i, y: 0, char, tone: 'name', phase: 0 }));

  it('picks a glyph showing the letter', () => {
    for (let k = 0; k < 20; k++) expect(glyphs[pickSource(glyphs, 'b')].char).toBe('B');
  });

  it('falls back to any glyph, or -1 when empty', () => {
    const i = pickSource(glyphs, 'Z', () => 0.6);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(pickSource([], 'A')).toBe(-1);
  });
});
