/**
 * Manuver design tokens — glossy orange, black & white.
 * Light/dark follow the system; Discover is forced dark via <ThemeScope scheme="dark">.
 * See DESIGN.md for the rationale behind every value.
 */

export type Scheme = 'light' | 'dark';

const orange = {
  // Glossy fill: lit top edge → brand orange → burnt base.
  glossTop: '#FF8F52',
  base: '#FF5A1F',
  glossBottom: '#E2400B',
};

/**
 * Brand screens (welcome, sign-in, loading) are black glass in every theme: a deep gradient
 * with a soft diagonal sheen, and translucent controls. No blur, so it stays light on
 * low-end phones. Orange appears only on the primary action and the logo.
 */
export const glass = {
  base: ['#101012', '#070708', '#000000'] as const,
  sheen: ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.025)', 'rgba(255,255,255,0)'] as const,
  fill: 'rgba(255,255,255,0.08)',
  fillPressed: 'rgba(255,255,255,0.15)',
  border: 'rgba(255,255,255,0.16)',
  highlight: 'rgba(255,255,255,0.30)',
  textMuted: 'rgba(255,255,255,0.72)',
};

export const lightTheme = {
  scheme: 'light' as Scheme,
  bg: '#F3F2F0',
  surface: '#FFFFFF',
  surfaceMuted: '#E6E4E1',
  surfacePressed: '#DAD7D3',
  border: '#E0DDD9',
  hairline: 'rgba(17,17,17,0.08)',

  text: '#111111',
  textSecondary: '#5C5955',
  textMuted: '#75716C',
  textDisabled: '#A9A5A0',

  // "Ink" = the black (light) / white (dark) secondary action.
  ink: '#111111',
  onInk: '#FFFFFF',

  primary: orange.base,
  primaryText: '#C2410C',
  primarySoft: 'rgba(255,90,31,0.12)',
  onPrimary: '#FFFFFF',
  gloss: [orange.glossTop, orange.base, orange.glossBottom] as const,

  danger: '#D92D20',
  dangerSoft: 'rgba(217,45,32,0.10)',
  success: '#12805C',
  successSoft: 'rgba(18,128,92,0.12)',

  scrim: 'rgba(17,17,17,0.45)',
  // Over photos and on black glass: always white, with a dark scrim behind it.
  onPhoto: '#FFFFFF',
  photoScrim: 'rgba(10,10,10,0.55)',
  glassTint: 'light' as 'light' | 'dark',
  glassFallback: 'rgba(255,255,255,0.92)',
  shadow: '#2B1A10',
};

export type Theme = typeof lightTheme;

export const darkTheme: Theme = {
  scheme: 'dark',
  bg: '#0A0A0A',
  surface: '#161616',
  surfaceMuted: '#232323',
  surfacePressed: '#2E2E2E',
  border: '#2A2A2A',
  hairline: 'rgba(255,255,255,0.08)',

  text: '#F5F5F4',
  textSecondary: '#A8A29E',
  textMuted: '#8C8782',
  textDisabled: '#57534E',

  ink: '#F5F5F4',
  onInk: '#0A0A0A',

  primary: orange.base,
  primaryText: '#FF7A3D',
  primarySoft: 'rgba(255,90,31,0.16)',
  onPrimary: '#FFFFFF',
  gloss: [orange.glossTop, orange.base, orange.glossBottom] as const,

  danger: '#FF5A4E',
  dangerSoft: 'rgba(255,90,78,0.14)',
  success: '#3DD68C',
  successSoft: 'rgba(61,214,140,0.14)',

  scrim: 'rgba(0,0,0,0.6)',
  onPhoto: '#FFFFFF',
  photoScrim: 'rgba(10,10,10,0.55)',
  glassTint: 'dark',
  glassFallback: 'rgba(22,22,22,0.94)',
  shadow: '#000000',
};

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  card: 16,
  sheet: 28,
  pill: 999,
} as const;

export const fonts = {
  display: 'Poppins_700Bold',
  displaySemi: 'Poppins_600SemiBold',
  body: 'Lato_400Regular',
  bodyBold: 'Lato_700Bold',
  bodyBlack: 'Lato_900Black',
} as const;

/** Type scale. Display uses Poppins with gentle negative tracking; body uses Lato. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  subheading: { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 22, letterSpacing: -0.1 },
} as const;
