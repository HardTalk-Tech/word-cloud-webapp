// The event name (title, colour, export prefix) depends on the screen theme the operator picks:
// see `event` in src/config/themes.ts.

export const BRAND = {
  name: 'George Steuart Health',
  // Sampled from public/brand/GS-Logo.png (crown red / wordmark grey) and GS-Health-Logo.png (teal).
  red: '#AC1F2D',
  /** "HEALTH" teal from the George Steuart Health wordmark. */
  teal: '#11B9A8',
  /** Event title colours (light → main → deep): gold for Achievers Night, silver for Arrowil Awards. */
  goldLight: '#F6DC8D',
  gold: '#D4AF37',
  goldDark: '#A9822A',
  silverLight: '#F4F6F8',
  silver: '#C3C9CF',
  silverDark: '#8A9198',
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

// LED screen colours (word cloud, wall, background, spotlight) live in the screen themes: src/config/themes.ts.

/**
 * Screen 2 wordmark: the real "George Steuart / HEALTH" drawn faint as a frame, with a sprinkle of small
 * random letters living inside its strokes (clipped to them). Letter colours come from the screen theme.
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
  letterOpacity: 0.88,
  seed: 'gsh-wordmark',
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
