export const colors = {
  background: '#FAF6F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F4EDE3',
  primary: '#FF8C42',
  primaryDark: '#F26B21',
  primarySoft: '#FFF0E3',
  text: '#2D2A26',
  textMuted: '#8A857D',
  border: '#EDE5DA',
  success: '#2FBF71',
  successSoft: '#E4F7EC',
  error: '#E5484D',
  errorSoft: '#FDEAEA',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#3D2E1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;
