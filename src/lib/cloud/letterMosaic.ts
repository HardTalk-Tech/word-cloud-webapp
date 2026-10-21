// "George Steuart / HEALTH" built from tiny random letters (pure). Stage coordinates.
import { rng, type Rng } from '@/lib/random';

export type GlyphTone = 'name' | 'health';

export type Glyph = {
  /** Centre, stage px. */
  x: number;
  y: number;
  char: string;
  tone: GlyphTone;
  /** Stable 0..1, for twinkle timing. */
  phase: number;
};

export type MosaicOptions = {
  /** Grid step in stage px (one letter per inked cell). */
  cell: number;
  seed: string;
  /** Alpha (0–255) that counts as an inked pixel. */
  threshold?: number;
  /** Share of a cell's pixels that must be inked for it to get a letter (thin serifs still count). */
  coverage?: number;
  /** Max random offset of a letter from its cell centre, × cell. */
  jitter?: number;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The teal "HEALTH" vs the grey name: teal is much greener than it is red. */
function toneOf(r: number, g: number): GlyphTone {
  return g - r > 60 ? 'health' : 'name';
}

/**
 * Walk a `cell` grid over RGBA pixels of the drawn wordmark (`width`×`height`, placed at `origin`) and put a
 * seeded random capital letter in every inked cell. The tone comes from the cell's most opaque pixel.
 */
export function buildLetterMosaic(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  origin: { x: number; y: number },
  { cell, seed, threshold = 110, coverage = 0.22, jitter = 0.12 }: MosaicOptions,
): Glyph[] {
  const random = rng(seed);
  const glyphs: Glyph[] = [];
  for (let top = 0; top < height; top += cell) {
    for (let left = 0; left < width; left += cell) {
      let inked = 0;
      let total = 0;
      let best = -1;
      let bestA = -1;
      for (let y = Math.floor(top); y < Math.min(height, top + cell); y++) {
        for (let x = Math.floor(left); x < Math.min(width, left + cell); x++) {
          const j = (y * width + x) * 4;
          const a = rgba[j + 3];
          total++;
          if (a >= threshold) inked++;
          if (a > bestA) {
            bestA = a;
            best = j;
          }
        }
      }
      if (!total || inked / total < coverage) continue;
      const i = best;
      const cx = left + cell / 2;
      const cy = top + cell / 2;
      glyphs.push({
        x: origin.x + cx + (random() - 0.5) * 2 * jitter * cell,
        y: origin.y + cy + (random() - 0.5) * 2 * jitter * cell,
        char: ALPHABET[Math.floor(random() * ALPHABET.length)],
        tone: toneOf(rgba[i], rgba[i + 1]),
        phase: random(),
      });
    }
  }
  return glyphs;
}

/** Index of a glyph showing `char` (random among matches), else any glyph; -1 when there are none. */
export function pickSource(glyphs: readonly Glyph[], char: string, random: Rng = Math.random): number {
  if (!glyphs.length) return -1;
  const want = char.toUpperCase();
  const matches: number[] = [];
  for (let i = 0; i < glyphs.length; i++) if (glyphs[i].char === want) matches.push(i);
  if (matches.length) return matches[Math.floor(random() * matches.length)];
  return Math.floor(random() * glyphs.length);
}
