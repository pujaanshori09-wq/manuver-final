import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ThemeScope } from '@/lib/theme';
import { GlassBackground } from './GlassBackground';

/**
 * Wraps a sign-in screen in the dark theme over the black-glass backdrop. The screen's own
 * container must be transparent so the glass shows through.
 *
 *   export default withAuthShell(LoginScreen);
 *
 * It is a wrapper (not a hook) on purpose: the screen's own useTheme() calls have to run
 * *inside* the dark ThemeScope.
 */
export function withAuthShell<P extends object>(Screen: React.ComponentType<P>) {
  function AuthShell(props: P) {
    return (
      <ThemeScope scheme="dark">
        <StatusBar style="light" />
        <GlassBackground />
        <Screen {...props} />
      </ThemeScope>
    );
  }
  AuthShell.displayName = `withAuthShell(${Screen.displayName || Screen.name || 'Screen'})`;
  return AuthShell;
}
