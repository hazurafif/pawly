// Material Design (Google) light palette — Google Blue primary, gray-50
// backgrounds, gray-300 outlines, semantic Google hues for status.
export const colors = {
  background: '#F8F9FA', // Google gray-50
  surface: '#FFFFFF',
  glass: 'rgba(255,255,255,0.85)',
  glassBorder: 'rgba(255,255,255,0.60)',
  surfaceMuted: '#E9EDF3', // M3 surface-variant
  primary: '#1A73E8', // Google Blue 600
  primaryDark: '#1967D2', // Google Blue 700 (pressed)
  primaryDeep: '#0B57D0', // Google Blue 800 (on-primary-container)
  primarySoft: '#D3E3FD', // M3 primary-container
  text: '#202124', // Google gray-900
  textMuted: '#5F6368', // Google gray-700
  border: '#DADCE0', // Google gray-300
  success: '#188038', // Google Green 700
  successSoft: '#E6F4EA', // Google Green 50
  successDeep: '#137333', // Google Green 800
  warning: '#F9AB00', // Google Yellow 600
  warningSoft: '#FEF7E0', // Google Yellow 50
  warningDeep: '#E37400', // Google Orange 700
  error: '#D93025', // Google Red 600
  errorSoft: '#FCE8E6', // Google Red 50
  errorDeep: '#C5221F', // Google Red 700
  white: '#FFFFFF',
} as const;

export type Palette = { [K in keyof typeof colors]: string };

// Material Design dark palette — Google dark surfaces, blue-300 accents.
// Soft tokens are translucent so they layer over `surface`.
export const darkColors: Palette = {
  background: '#131314',
  surface: '#1E1F20',
  glass: 'rgba(30,31,32,0.75)',
  glassBorder: 'rgba(30,31,32,0.45)',
  surfaceMuted: '#28292B',
  primary: '#8AB4F8', // Google Blue 300
  primaryDark: '#669DF6', // pressed
  primaryDeep: '#C2E7FF', // on-primary-container
  primarySoft: 'rgba(138,180,248,0.16)',
  text: '#E8EAED', // Google gray-200
  textMuted: '#9AA0A6', // Google gray-500
  border: '#3C4043', // Google gray-800
  success: '#81C995', // Google Green 300
  successSoft: 'rgba(129,201,149,0.16)',
  successDeep: '#A8DAB5',
  warning: '#FDD663', // Google Yellow 300
  warningSoft: 'rgba(253,214,99,0.16)',
  warningDeep: '#FEEFC3',
  error: '#F28B82', // Google Red 300
  errorSoft: 'rgba(242,139,130,0.16)',
  errorDeep: '#F6C0BA',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

// Material typeface (Roboto) family names, as registered by expo-font in
// app/_layout.tsx. Text styles set fontFamily instead of fontWeight.
export const fonts = {
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold',
} as const;

// Material 3 shape scale: small 4, medium 8, large 16, extra-large 28.
export const radius = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 28,
  pill: 999,
} as const;

// Bottom padding required on tab screens so content clears the floating
// tab bar (height 64 + bottom offset up to ~insets+8, plus breathing room).
export const tabBarClearance = 120;

export const shadow = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;

// ─── Material 3 (M3) token system ─────────────────────────────────
// Semantic color roles per the Material 3 spec, blue tonal palette.
// The legacy `colors`/`darkColors` objects remain as back-compat tokens;
// new code reads roles through useM3Roles() (hooks/useTheme.tsx).

export const m3LightRoles = {
  primary: '#1A73E8',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D3E3FD',
  onPrimaryContainer: '#0B57D0',
  secondary: '#5F6368',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E9EDF3',
  onSecondaryContainer: '#3C4043',
  tertiary: '#7A6FA8',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E8E0F5',
  onTertiaryContainer: '#4A3F6B',
  error: '#D93025',
  onError: '#FFFFFF',
  errorContainer: '#FCE8E6',
  onErrorContainer: '#C5221F',
  surface: '#F8F9FA',
  onSurface: '#202124',
  surfaceVariant: '#E9EDF3',
  onSurfaceVariant: '#5F6368',
  outline: '#DADCE0',
  outlineVariant: '#E1E3E6',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F1F3F4',
  surfaceContainer: '#E9EDF3',
  surfaceContainerHigh: '#DFE3E8',
  surfaceContainerHighest: '#D5D9DE',
  inverseSurface: '#202124',
  onInverseSurface: '#F8F9FA',
  inversePrimary: '#8AB4F8',
  scrim: 'rgba(0,0,0,0.5)',
} as const;

export type M3Roles = { [K in keyof typeof m3LightRoles]: string };

export const m3DarkRoles: M3Roles = {
  primary: '#8AB4F8',
  onPrimary: '#062E6F',
  primaryContainer: '#123F8E',
  onPrimaryContainer: '#D3E3FD',
  secondary: '#9AA0A6',
  onSecondary: '#3C4043',
  secondaryContainer: '#3C4043',
  onSecondaryContainer: '#DADCE0',
  tertiary: '#C4B5E8',
  onTertiary: '#4A3F6B',
  tertiaryContainer: '#5C4F8F',
  onTertiaryContainer: '#E8E0F5',
  error: '#F28B82',
  onError: '#C5221F',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F6C0BA',
  surface: '#131314',
  onSurface: '#E8EAED',
  surfaceVariant: '#28292B',
  onSurfaceVariant: '#9AA0A6',
  outline: '#3C4043',
  outlineVariant: '#45484B',
  surfaceContainerLowest: '#1E1F20',
  surfaceContainerLow: '#232426',
  surfaceContainer: '#28292B',
  surfaceContainerHigh: '#2E2F31',
  surfaceContainerHighest: '#343537',
  inverseSurface: '#E8EAED',
  onInverseSurface: '#202124',
  inversePrimary: '#1A73E8',
  scrim: 'rgba(0,0,0,0.5)',
};

// M3 type scale — fontFamily mirrors the Roboto registration in _layout.
export const typeScale = {
  displaySmall: { fontSize: 36, lineHeight: 44, fontFamily: 'Roboto_400Regular', letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontFamily: 'Roboto_400Regular', letterSpacing: 0 },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontFamily: 'Roboto_400Regular', letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, fontFamily: 'Roboto_400Regular', letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, fontFamily: 'Roboto_500Medium', letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontFamily: 'Roboto_500Medium', letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontFamily: 'Roboto_400Regular', letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontFamily: 'Roboto_400Regular', letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontFamily: 'Roboto_400Regular', letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontFamily: 'Roboto_500Medium', letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontFamily: 'Roboto_500Medium', letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontFamily: 'Roboto_500Medium', letterSpacing: 0.5 },
} as const;

// M3 state layers — translucent overlays of the container's "on-" color.
export type StateLayer = 'hover' | 'focus' | 'pressed' | 'dragged';
export const STATE_LAYER_OPACITY: Record<StateLayer, number> = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
};

// rgba() of a hex color at a given opacity (state layers, disabled tones).
export function withAlpha(hex: string, opacity: number): string {
  const full = hex.replace('#', '');
  const rgb = full.length === 3 ? full.split('').map((c) => c + c).join('') : full;
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function stateOverlay(color: string, layer: StateLayer): string {
  return withAlpha(color, STATE_LAYER_OPACITY[layer]);
}

// M3 elevation maps 0-5 onto the surface-container tones (shadow stays
// decorative; the tonal lift is the elevation signal).
export function surfaceForLevel(roles: M3Roles, level: number): string {
  if (level <= 0) return roles.surfaceContainerLowest;
  if (level === 1) return roles.surfaceContainerLow;
  if (level === 2) return roles.surfaceContainer;
  if (level === 3) return roles.surfaceContainerHigh;
  return roles.surfaceContainerHighest;
}
