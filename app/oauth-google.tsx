import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { withAuthShell } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

// On the web this page opens inside the sign-in popup: hand the URL back to the opener and close.
const handledByOpener = WebBrowser.maybeCompleteAuthSession().type === 'success';

/**
 * Where Google's redirect lands (manuverapp://oauth-google?code=…). Usually the in-app browser
 * session catches it first; this screen covers the cases where the OS opens the link instead.
 */
function OAuthGoogleScreen() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const { completeGoogleSignIn } = useAuth();
  const router = useRouter();
  const tr = useT();
  const started = useRef(false);

  useEffect(() => {
    if (handledByOpener || started.current) return;
    started.current = true;
    (async () => {
      try {
        if (!code) throw new ApiError(400, error ?? 'google_failed', error ?? 'google_failed');
        await completeGoogleSignIn(code);
        // The root navigator moves on to onboarding or the app.
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'cancelled')) Alert.alert(tr('login.failedTitle'), apiErrorMessage(e, tr));
        router.replace('/login');
      }
    })();
  }, [code, error, completeGoogleSignIn, router, tr]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#FF5A1F" />
    </View>
  );
}

export default withAuthShell(OAuthGoogleScreen);

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
