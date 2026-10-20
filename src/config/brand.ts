export const BRAND = {
  name: 'George Steuart',
  // Sampled from public/brand/GS-Logo.png (crown red / wordmark grey).
  red: '#AC1F2D',
  redLight: '#C8303F',
  redDark: '#6E1420',
  grey: '#8A8A8D',
  greyLight: '#C9C9CC',
  logoGrey: '#64666A',
  white: '#FFFFFF',
  background: '#0B0B0D',
  surface: '#16161A',
  surfaceRaised: '#202026',
  // Generated from GS-Logo.png by `npm run brand` (scripts/make-brand-assets.ts).
  /** Red crown only, transparent. */
  crown: '/brand/crown.png',
  /** "George Steuart" only, lightened for dark backgrounds. */
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

/** CSS variables set by next/font in the root layout. Canvas code reads them at runtime. */
export const FONT_VARS = {
  display: '--font-display',
  serif: '--font-serif-face',
} as const;

/** Glyph fallbacks for Sinhala / Tamil names on the event laptop and phones. */
export const FONT_FALLBACK = '"Nirmala UI", "Noto Sans Sinhala", "Noto Sans Tamil", "Iskoola Pota", system-ui, sans-serif';

export const COPY = {
  landingHeadline: 'Join the wall',
  landingSub: 'Snap a selfie and see yourself on the big screen.',
  joinButton: 'Join Event',
  continueButton: 'Continue',
  consent: 'Your photo and name will be shown on the event screens.',
  successTitle: 'Look at the big screen!',
  thanksTitle: 'Thank you!',
  thanksSub: 'Your answers are on the second screen.',
  welcome: 'Welcome',
} as const;
