// Animated LED-wall background (dark red glow, light beams, bokeh dots).
// Drawn on its own canvas behind each screen, so it never forces the wall / cloud to redraw.

export type BackgroundVariant = 'welcome' | 'cloud';

export const BACKGROUND = {
  enabled: true,
  /** false = draw one still frame (lowest GPU use). */
  animate: true,
  /** Background redraw rate; it moves slowly, 30 is plenty. */
  fps: 30,
  seed: 'gs-bg',
  colors: {
    glow: '#4A0912',
    mid: '#1C0509',
    base: '#0B0B0D',
    beam: [255, 52, 72] as const,
    dots: ['#FF3B4E', '#E0283A', '#FF8A94', '#B81E30'],
  },
  variants: {
    /** Screen 1: photos are opaque, so the background can be rich. */
    welcome: { intensity: 1, beams: 16, beamDots: 70, floorRows: 7, centerDarken: 0 },
    /** Screen 2: red words sit on top, so keep it calmer and darken behind the crown. */
    cloud: { intensity: 0.65, beams: 12, beamDots: 40, floorRows: 6, centerDarken: 0.7 },
  } satisfies Record<BackgroundVariant, { intensity: number; beams: number; beamDots: number; floorRows: number; centerDarken: number }>,
} as const;
