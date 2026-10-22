// Animated LED-wall background (coloured glow, light beams, bokeh dots). Colours come from the screen
// theme (`src/config/themes.ts`). Drawn on its own canvas behind each screen, so it never forces the
// wall / cloud to redraw.

export type BackgroundVariant = 'welcome' | 'cloud';

export const BACKGROUND = {
  enabled: true,
  /** false = draw one still frame (lowest GPU use). */
  animate: true,
  /** Background redraw rate; it moves slowly, so 20 looks the same as 30 at two-thirds of the cost. */
  fps: 20,
  /** Lights fainter than this are never drawn (they were invisible anyway). */
  minDotAlpha: 0.05,
  seed: 'gs-bg',
  variants: {
    /** Screen 1: photos are opaque, so the background can be rich. */
    welcome: { intensity: 1, beams: 14, beamDots: 45, floorRows: 5, centerDarken: 0 },
    /** Screen 2: red words sit on top, so keep it calmer and darken behind the crown. */
    cloud: { intensity: 0.65, beams: 10, beamDots: 28, floorRows: 4, centerDarken: 0.7 },
  } satisfies Record<BackgroundVariant, { intensity: number; beams: number; beamDots: number; floorRows: number; centerDarken: number }>,
} as const;
