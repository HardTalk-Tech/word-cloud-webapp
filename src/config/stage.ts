// TBD: depends on LED pixel pitch + LED processor input. Placeholder is a typical P3.9 wall (16ft x 15ft).
export const STAGE = {
  width: 1248,
  height: 1170,
} as const;

/** Cap on the canvas backing-store scale (see `stagePixelRatio`: the device pixels the stage covers on screen). */
export const MAX_DPR = 2;

/** Main wall: top band reserved for the stacked George Steuart Health logo. */
export const WALL_HEADER_RATIO = 0.16;
export const WALL_PADDING = 24;

/**
 * Main wall: the newest attendees as round photos on a fixed 5 × 5 grid (25 on screen).
 * Nobody moves: a new arrival takes a free spot, or the spot of the oldest person on the wall.
 */
export const WALL_GRID = {
  cols: 5,
  rows: 5,
  /** Circle diameter as a share of its grid cell. */
  fill: 0.82,
} as const;

/** Decorative rings behind the grid (radius × half the grid size); the outer ones run past the grid. */
export const RING_PATTERN = {
  radii: [0.42, 0.78, 1.1, 1.28],
} as const;
