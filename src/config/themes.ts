// Colour themes for the two LED screens (Screen 1 welcome wall, Screen 2 word cloud), switched live from the
// operator dashboard. Same layout, features and animation in every theme: only colours change, plus the event
// name shown on phones / login / dashboard. Phones keep their own look; they only read the event name.

export type ThemeId = 'crimson' | 'midnight';
export type Rgb = readonly [number, number, number];

export type ThemeEvent = {
  /** Headline on the phone landing page, login and dashboard. */
  title: string;
  /** Browser tab title on the phone. */
  fullName: string;
  /** Colour of the event title on the phone / dashboard. */
  titleStyle: 'gold' | 'silver';
};

export type ScreenTheme = {
  id: ThemeId;
  /** Dashboard label + preview colours. */
  label: string;
  description: string;
  swatch: readonly [string, string, string];
  event: ThemeEvent;

  /** Animated LED background. */
  background: { glow: string; mid: string; base: string; beam: Rgb; dots: readonly string[]; pool: Rgb };
  /** Main accent: ring pattern, spotlight ring, accent bars. */
  accent: string;
  /** Soft accent for department text. */
  accentSoft: string;
  /** Faint decorative crowns (wall watermark, cloud ghost, finale) are tinted this colour; null = brand red as is. */
  crownTint: string | null;
  confetti: readonly string[];

  wall: {
    /** Photo circle rim (top → bottom). */
    rim: readonly [string, string];
    /** Empty-spot glass circle. */
    glass: { from: string; to: string; stroke: string };
    /** Highlight ring around new arrivals / ambient glow. */
    ring: Rgb;
    /** Flash under a landing photo. */
    glow: string;
    /** Travelling ring pulses and exit sparks. */
    spark: string;
    sweep: Rgb;
    /** Name badge: glass pill (top → bottom), rim, divider. */
    label: { top: string; bottom: string; stroke: string; divider: Rgb };
  };

  spotlight: {
    rayStrong: Rgb;
    raySoft: Rgb;
    rayMid: string;
    rayEnd: Rgb;
    core: Rgb;
    panel: readonly [string, string];
    /** Dim layer over the blurred wall behind the card. */
    dim: string;
  };

  cloud: {
    /** 0 = top 3 (white, with halo), 1 = next, 2 = middle, 3 = least chosen. */
    tiers: readonly [string, string, string, string];
    halo: Rgb;
    filler: readonly string[];
    outline: string;
    /** Glow behind letters popping out of the wordmark. */
    spark: string;
    /** Star sparks trailing flying letters. */
    star: string;
    /** Letter-mosaic wordmark colours. */
    mosaicName: string;
    mosaicHealth: string;
    twinkle: string;
  };
};

/** Current look (dark red), the default. */
const CRIMSON: ScreenTheme = {
  id: 'crimson',
  label: 'Crimson',
  description: 'Dark red stage lights · Achievers Night 2026',
  swatch: ['#1C0509', '#AC1F2D', '#FF9AA6'],
  event: {
    title: 'Achievers Night 2026',
    fullName: 'George Steuart Health Achievers Night 2026',
    titleStyle: 'gold',
  },
  background: {
    glow: '#4A0912',
    mid: '#1C0509',
    base: '#0B0B0D',
    beam: [255, 52, 72],
    dots: ['#FF3B4E', '#E0283A', '#FF8A94', '#B81E30'],
    pool: [8, 4, 6],
  },
  accent: '#AC1F2D',
  accentSoft: '#FF9AA6',
  crownTint: null,
  confetti: ['#AC1F2D', '#FFFFFF', '#B3B5B8', '#E04656'],
  wall: {
    rim: ['#E2475A', '#7A1622'],
    glass: { from: 'rgba(120,22,36,0.42)', to: 'rgba(40,8,14,0.42)', stroke: 'rgba(214,60,78,0.34)' },
    ring: [232, 62, 80],
    glow: 'rgba(232,52,72,1)',
    spark: '#FFD9DD',
    sweep: [255, 230, 234],
    label: { top: 'rgba(46,14,22,0.94)', bottom: 'rgba(12,6,8,0.94)', stroke: 'rgba(226,71,90,0.85)', divider: [226, 71, 90] },
  },
  spotlight: {
    rayStrong: [255, 170, 180],
    raySoft: [255, 90, 105],
    rayMid: 'rgba(210,40,60,0.18)',
    rayEnd: [172, 31, 45],
    core: [255, 200, 205],
    panel: ['rgba(40,14,20,0.72)', 'rgba(14,8,10,0.78)'],
    dim: 'rgba(11,11,13,0.65)',
  },
  cloud: {
    tiers: ['#FFFFFF', '#FF9AA6', '#D8384A', '#9E1E2E'],
    halo: [172, 31, 45],
    filler: ['#9A1C2B', '#B5303F', '#7E1824'],
    outline: '#FF4D5E',
    spark: '#FFD9DD',
    star: '#FFE6EA',
    mosaicName: '#F2EEEA',
    mosaicHealth: '#A8F2E8',
    twinkle: '#FFFFFF',
  },
};

/** Deep navy with blue light beams, blue-white star bokeh and a few warm red sparks (client samples). */
const MIDNIGHT: ScreenTheme = {
  id: 'midnight',
  label: 'Midnight Blue',
  description: 'Navy sky with blue starlight · Arrowil Awards Ceremony 2026',
  swatch: ['#071538', '#2F7DF6', '#A9D0FF'],
  event: {
    title: 'ARROWIL AWARDS CEREMONY 2026',
    fullName: 'George Steuart Health Arrowil Awards Ceremony 2026',
    titleStyle: 'silver',
  },
  background: {
    glow: '#0E2A6B',
    mid: '#071538',
    base: '#03081A',
    beam: [70, 130, 255],
    // Mostly blue / ice-white stars, with a little warm red and orange like the samples.
    dots: ['#6FA8FF', '#3D7BFF', '#CFE2FF', '#8FC1FF', '#FF5A4E', '#FF8A4C'],
    pool: [2, 6, 18],
  },
  accent: '#2F7DF6',
  accentSoft: '#A9D0FF',
  crownTint: '#4F8BFF',
  confetti: ['#2F7DF6', '#FFFFFF', '#C0C6CC', '#6FB1FF', '#FF5A4E'],
  wall: {
    rim: ['#7DB8FF', '#1C3F9A'],
    glass: { from: 'rgba(28,58,140,0.42)', to: 'rgba(6,14,40,0.42)', stroke: 'rgba(90,150,255,0.34)' },
    ring: [80, 150, 255],
    glow: 'rgba(60,130,255,1)',
    spark: '#DCEBFF',
    sweep: [220, 235, 255],
    label: { top: 'rgba(14,26,62,0.94)', bottom: 'rgba(5,9,24,0.94)', stroke: 'rgba(96,160,255,0.85)', divider: [96, 160, 255] },
  },
  spotlight: {
    rayStrong: [170, 205, 255],
    raySoft: [90, 140, 255],
    rayMid: 'rgba(40,90,210,0.18)',
    rayEnd: [31, 70, 172],
    core: [200, 220, 255],
    panel: ['rgba(14,28,70,0.72)', 'rgba(6,10,26,0.78)'],
    dim: 'rgba(3,8,26,0.65)',
  },
  cloud: {
    tiers: ['#FFFFFF', '#A9D0FF', '#4F93FF', '#2B5FC9'],
    halo: [47, 125, 246],
    filler: ['#2752B5', '#3567D6', '#1E4296'],
    outline: '#6FB1FF',
    spark: '#DCEBFF',
    star: '#E6F0FF',
    mosaicName: '#EEF3FF',
    mosaicHealth: '#A8F2E8',
    twinkle: '#FFFFFF',
  },
};

export const THEMES: Record<ThemeId, ScreenTheme> = { crimson: CRIMSON, midnight: MIDNIGHT };
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
/** The current look stays the default; operators switch from the dashboard. */
export const DEFAULT_THEME: ThemeId = 'crimson';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}

export function themeOf(id: unknown): ScreenTheme {
  return THEMES[isThemeId(id) ? id : DEFAULT_THEME];
}
