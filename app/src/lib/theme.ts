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
