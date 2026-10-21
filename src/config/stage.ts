// TBD: depends on LED pixel pitch + LED processor input. Placeholder is a typical P3.9 wall (16ft x 15ft).
export const STAGE = {
  width: 1248,
  height: 1170,
} as const;

/** Canvas backing store = stage size x devicePixelRatio, capped. */
export const MAX_DPR = 2;

/** Main wall: top band reserved for the stacked George Steuart Health logo. */
export const WALL_HEADER_RATIO = 0.16;
export const WALL_PADDING = 24;

/**
 * Main wall: the newest attendees as circles on concentric rings (centre, inner, outer).
 * Slot 0 = centre (newest); each new arrival pushes everyone one slot outward.
 */
export const RING_WALL = {
  /** Circles per ring, centre outward. Total = how many attendees the wall shows. */
  rings: [1, 8, 16],
  /** Circle diameter per ring, × wall-area height. */
  diameter: [0.3, 0.18, 0.135],
  /** Ring radius per ring (ellipse), × half the wall-area width / height. */
  radiusX: [0, 0.48, 0.865],
  radiusY: [0, 0.51, 0.845],
} as const;
