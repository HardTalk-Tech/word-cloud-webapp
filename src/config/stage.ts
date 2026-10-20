// TBD: depends on LED pixel pitch + LED processor input. Placeholder is a typical P3.9 wall (16ft x 15ft).
export const STAGE = {
  width: 1248,
  height: 1170,
} as const;

/** Canvas backing store = stage size x devicePixelRatio, capped. */
export const MAX_DPR = 2;

/** Main wall: top band reserved for the wordmark + live counter. */
export const WALL_HEADER_RATIO = 0.08;
export const WALL_PADDING = 24;
export const WALL_GAP = 4;
