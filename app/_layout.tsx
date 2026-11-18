import { Redirect, Stack, SplashScreen, useSegments } from 'expo-router';
import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { ActivityIndicator, Text, View, Platform, TouchableOpacity, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { BrandStage, GlassBackground } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, darkTheme, lightTheme, type } from '@/lib/theme';
import { LanguageProvider, translate } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

// Screens import useAuth from here; the implementation lives in lib/auth.tsx.
export { useAuth };

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by RootErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: darkTheme.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ ...type.title, color: darkTheme.text, marginBottom: 12, textAlign: 'center' }}>
            {translate('common.error')}
          </Text>
          <Text style={{ ...type.callout, color: darkTheme.textSecondary, textAlign: 'center', marginBottom: 24 }}>
            {__DEV__ && this.state.error ? this.state.error.toString() : translate('common.errorBody')}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: darkTheme.primary, paddingHorizontal: 28, minHeight: 50, justifyContent: 'center', borderRadius: 999 }}
            onPress={this.handleReset}
            accessibilityRole="button"
          >
            <Text style={{ ...type.button, color: '#FFFFFF' }}>{translate('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
    },
  },
});

export default function RootLayout() {
  // Load brand fonts before hiding the splash screen.
  const [fontsLoaded, fontError] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Render nothing (the splash stays up) until the fonts are ready. Android measures text once with
  // the fallback font and does not re-measure when the brand font arrives, which clips labels.
  if (!fontsLoaded && !fontError) return null;

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <ThemeProvider>
          <LanguageProvider>
            <QueryClientProvider client={queryClient}>
              {/* Signing out drops every cached query so the next account starts clean. */}
              <AuthProvider onSignOut={() => queryClient.clear()}>
                <Navigator />
              </AuthProvider>
            </QueryClientProvider>
          </LanguageProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}

const AUTH_ROUTES = ['login', 'register', 'welcome', 'forgot-password', 'reset-password', 'oauth-google'];

/** Routes the user to sign-in, onboarding, or the app depending on the session. */
function Navigator() {
  const { session, me, loading, checkingProfile } = useAuth();
  const segments = useSegments();
  const scheme = useColorScheme();
  const rootTheme = scheme === 'dark' ? darkTheme : lightTheme;

  const inAuthGroup = AUTH_ROUTES.includes(segments[0] as string);
  const inOnboarding = (segments[0] as string) === 'onboarding';

  let redirectTo: string | null = null;
  if (!loading) {
    if (!session) {
      if (!inAuthGroup) redirectTo = '/welcome';
    } else if (me && !me.profile.onboardingCompleted) {
      if (!inOnboarding) redirectTo = '/onboarding/flow';
    } else if (me && (inAuthGroup || inOnboarding) && (segments[0] as string) !== 'reset-password') {
      redirectTo = '/';
    }
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: rootTheme.bg } }}>
        {/* Sign-in flow: short cross-fade over black, so the logo seems to stay put. */}
        {AUTH_ROUTES.map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{ animation: 'fade', animationDuration: 260, contentStyle: { backgroundColor: darkTheme.bg } }}
          />
        ))}
        <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      {redirectTo && <Redirect href={redirectTo as any} />}

      {/* Same black glass and logo position as Welcome, so when loading ends the overlay
          fades out and the logo carries straight into the next screen. */}
      {(loading || (session && checkingProfile && !me)) && (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(450)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
        >
          <GlassBackground />
          <BrandStage entering={false} />
        </Animated.View>
      )}
    </>
  );
}
