export const colors = {
  background: '#F8F6F2',
  surface: '#FFFFFF',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.35)',
  surfaceMuted: '#F4EDE3',
  primary: '#FF8A3D',
  primaryDark: '#F26B21',
  primaryDeep: '#A94E0E',
  primarySoft: '#FFF0E3',
  text: '#2A2826',
  textMuted: '#6E6963',
  border: '#EDE5DA',
  success: '#6CBF84',
  successSoft: '#E4F7EC',
  successDeep: '#1E7A44',
  warning: '#F3B54A',
  warningSoft: '#FBF0DC',
  error: '#E66A5C',
  errorSoft: '#FDEAEA',
  errorDeep: '#B4473B',
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

export const radius = {
  sm: 18,
  md: 28,
  lg: 32,
  pill: 999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#3D2E1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  md: {
    shadowColor: '#3D2E1C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 32,
    elevation: 4,
  },
  lg: {
    shadowColor: '#3D2E1C',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.08,
    shadowRadius: 60,
    elevation: 8,
  },
  card: {
    shadowColor: '#3D2E1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
} as const;
