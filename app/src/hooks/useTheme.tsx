import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkColors, type Palette } from '../lib/theme';

const ThemeContext = createContext<Palette>(colors);

// ThemeProvider + useAppColors: picks the light or dark palette from the
// system appearance. Every component that renders `colors.*` should read
// them through this hook so dark mode works app-wide.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const palette = useMemo(() => (scheme === 'dark' ? darkColors : colors), [scheme]);
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

export function useAppColors(): Palette {
  return useContext(ThemeContext);
}

// Builds a component's StyleSheet from the active palette, memoized per
// theme change. Pass a module-level `createStyles` factory so its identity
// is stable across renders.
export function useStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useAppColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
