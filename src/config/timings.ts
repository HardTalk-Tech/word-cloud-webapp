export const SPOTLIGHT = {
  inMs: 600,
  flyMs: 900,
  /** Queue length (including the person being shown) → hold time. */
  holdShortMs: 3500, // queue 1–3
  holdMediumMs: 2000, // queue 4–10
  holdGroupMs: 3000, // queue > 10
  shortQueueMax: 3,
  mediumQueueMax: 10,
  groupMax: 4,
  /** Wait at most this long for the spot photo to decode before showing the tile/lqip instead. */
  imageWaitMs: 4000,
  /** Max attendees re-queued after a page reload. */
  reloadCatchUpMax: 10,
} as const;

export const WALL = {
  tierChangeMs: 1200,
  popMs: 450,
  landBounceMs: 420,
  ambientEveryMinMs: 2000,
  ambientEveryMaxMs: 3000,
  ambientDurationMs: 1000,
  hideFadeMs: 400,
  watermarkOpacity: 0.05,
  /** Red glow that flashes in a slot when a photo lands / pops in. */
  landGlowMs: 900,
  /** New arrivals keep a soft red ring that fades out over this long. */
  newArrivalMs: 30000,
  newArrivalMax: 8,
  /** Diagonal light sweep across the wall every 20–30 s. */
  sweepEveryMinMs: 20000,
  sweepEveryMaxMs: 30000,
  sweepMs: 1800,
  /** Ring wall: everyone glides one slot outward when someone new arrives. */
  shiftMs: 900,
  /** Shift starts ring by ring (centre first) so the move ripples outward. */
  rippleDelayMs: 140,
  /** The oldest circle drifts out and dissolves when pushed off the wall. */
  exitMs: 900,
  /** One full turn per ring (ms); negative = anticlockwise, 0 = still. */
  ringRevMs: [0, 140000, -200000],
  /** Gentle float of each circle. */
  bobPx: 5,
  bobMs: 5200,
  /** Centre circle halo breathing period. */
  haloMs: 3200,
  /** Light pulses travelling round each ring's orbit line. */
  orbitPulseMs: 9000,
} as const;

export const FINAL = {
  totalMs: 2500,
  maxStaggerMs: 1000,
  wordmarkFadeMs: 800,
} as const;

export const CLOUD = {
  /** Re-run layout at most this often, only when counts changed. */
  relayoutEveryMs: 6000,
  tweenMs: 1200,
  pulseMs: 800,
  autoRotateEveryMs: 30000,
  dimOpacity: 0.25,
  focusTweenMs: 600,
  /** New answers: chosen words rise from the bottom and join the crown. */
  flyMs: 1500,
  maxFlyers: 14,
  /** Redraw rate when only the gentle idle motion (twinkle / breathe / outline lights) is running. */
  idleFps: 30,
} as const;

export const PHONE = {
  successAutoContinueMs: 2500,
  uploadRetries: 3,
  retryBaseMs: 1000,
} as const;
