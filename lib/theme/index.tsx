import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, Scheme, Theme } from './tokens';

export * from './tokens';

const ThemeContext = createContext<Theme>(lightTheme);

/** Root provider: follows the system light/dark setting. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const theme = system === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Forces a scheme for a subtree (Discover is always dark). */
export function ThemeScope({ scheme, children }: { scheme: Scheme; children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={scheme === 'dark' ? darkTheme : lightTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Theme-aware StyleSheet factory.
 *   const useStyles = makeStyles((t) => StyleSheet.create({ ... }));
 *   const s = useStyles();
 */
export function makeStyles<T>(factory: (t: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const t = useTheme();
    return useMemo(() => {
      let styles = cache.get(t);
      if (!styles) {
        styles = factory(t);
        cache.set(t, styles);
      }
      return styles;
    }, [t]);
  };
}
