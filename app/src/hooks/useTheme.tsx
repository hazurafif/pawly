import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  colors,
  darkColors,
  m3DarkRoles,
  m3LightRoles,
  type M3Roles,
  type Palette,
} from '../lib/theme';

interface ThemeValue {
  palette: Palette;
  roles: M3Roles;
}

const LIGHT: ThemeValue = { palette: colors, roles: m3LightRoles };
const DARK: ThemeValue = { palette: darkColors, roles: m3DarkRoles };

const ThemeContext = createContext<ThemeValue>(LIGHT);

// ThemeProvider + useAppColors: picks the light or dark palette from the
// system appearance. Every component that renders `colors.*` should read
// them through this hook so dark mode works app-wide.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo(() => (scheme === 'dark' ? DARK : LIGHT), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppColors(): Palette {
  return useContext(ThemeContext).palette;
}

// Material 3 semantic color roles for the active scheme (see theme.ts).
export function useM3Roles(): M3Roles {
  return useContext(ThemeContext).roles;
}

// Builds a component's StyleSheet from the active theme, memoized per
// theme change. Factories may read the legacy palette, the M3 roles, or
// both — a one-arg factory (palette only) still typechecks.
export function useStyles<T>(factory: (colors: Palette, roles: M3Roles) => T): T {
  const { palette, roles } = useContext(ThemeContext);
  return useMemo(() => factory(palette, roles), [palette, roles, factory]);
}
