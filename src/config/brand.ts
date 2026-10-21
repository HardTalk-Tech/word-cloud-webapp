/** The event. Shown on the phone landing page, both LED screens, the dashboard and page titles. */
export const EVENT = {
  /** Short title for headlines and the screens. */
  title: 'Achievers Night 2026',
  /** Full name for page titles and exports. */
  fullName: 'George Steuart Health Achievers Night 2026',
} as const;

export const BRAND = {
  name: 'George Steuart Health',
  // Sampled from public/brand/GS-Logo.png (crown red / wordmark grey) and GS-Health-Logo.png (teal).
  red: '#AC1F2D',
  /** "HEALTH" teal from the George Steuart Health wordmark. */
  teal: '#11B9A8',
  /** Event title ("Achievers Night 2026"): metallic gold, light → main → deep. */
  goldLight: '#F6DC8D',
  gold: '#D4AF37',
  goldDark: '#A9822A',
  redLight: '#C8303F',
  redDark: '#6E1420',
  grey: '#8A8A8D',
  greyLight: '#C9C9CC',
  logoGrey: '#64666A',
  white: '#FFFFFF',
  background: '#0B0B0D',
  surface: '#16161A',
  surfaceRaised: '#202026',
  // Generated from GS-Logo.png + GS-Health-Logo.png by `npm run brand` (scripts/make-brand-assets.ts).
  /** Red crown only, transparent. */
  crown: '/brand/crown.png',
  /** "George Steuart / HEALTH" (two lines), grey lightened for dark backgrounds. */
  wordmark: '/brand/wordmark.png',
  /** Crown + wordmark stacked, for dark backgrounds. */
  logo: '/brand/logo-dark.png',
  /** Solid crown silhouette (white on transparent): the shape the cloud and final mosaic fill. */
  crownMask: '/brand/crown-mask.png',
  confetti: ['#AC1F2D', '#FFFFFF', '#B3B5B8', '#E04656'],
} as const;

/** Word-cloud colours (Screen 2). Tiers by rank of the answer. */
export const CLOUD_PALETTE = {
  /** 0 = top 3 (white with red halo), 1 = next (light rose), 2 = middle (brand red), 3 = least chosen. */
  tiers: ['#FFFFFF', '#FF9AA6', '#D8384A', '#9E1E2E'],
  /** Halo behind top-tier words: [r, g, b]. */
  halo: [172, 31, 45] as const,
  /** Small repeated words that fill the crown: deep reds, drawn faint. */
  filler: ['#9A1C2B', '#B5303F', '#7E1824'],
  /** Lights along the crown outline. */
  outline: '#FF4D5E',
} as const;

/**
 * Screen 2 wordmark: the real "George Steuart / HEALTH" drawn faint as a frame, with a sprinkle of small
 * random letters living inside its strokes (clipped to them).
 */
export const WORDMARK_MOSAIC = {
  /** Wordmark width, × stage width. */
  widthRatio: 0.6,
  /** Opacity of the real wordmark underneath. */
  frameOpacity: 0.35,
  /** At most one letter per `cell` stage px, only where a stroke covers ≥ `coverage` of the cell. */
  cell: 8,
  coverage: 0.4,
  /** Share of eligible cells that get a letter (a few stay empty so the faint frame shows through). */
  keep: 0.88,
  /** Letter size, × cell. */
  fontScale: 0.95,
  /** Letter colours: brighter tints of the stroke underneath. */
  name: '#F2EEEA',
  health: '#A8F2E8',
  letterOpacity: 0.88,
  /** Twinkling letters drawn brighter on top. */
  twinkle: '#FFFFFF',
  seed: 'gsh-wordmark',
  /** Soft star sparks shed by letters flying out of the wordmark. */
  spark: '#FFE6EA',
} as const;

/** CSS variables set by next/font in the root layout. Canvas code reads them at runtime. */
export const FONT_VARS = {
  display: '--font-display',
  serif: '--font-serif-face',
} as const;

/** Glyph fallbacks for Sinhala / Tamil names on the event laptop and phones. */
export const FONT_FALLBACK = '"Nirmala UI", "Noto Sans Sinhala", "Noto Sans Tamil", "Iskoola Pota", system-ui, sans-serif';

export const COPY = {
  landingEyebrow: 'Welcome to',
  landingSub: 'Snap a selfie and see yourself on the big screen.',
  joinButton: 'Join Event',
  continueButton: 'Continue',
  consent: 'Your photo and name will be shown on the event screens.',
  successTitle: 'Look at the big screen!',
  thanksTitle: 'Thank you!',
  thanksSub: 'Your answers are on the screen.',
  welcome: 'Welcome',
} as const;
