import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ApiError, authApi } from '@/lib/api';
import { apiErrorMessage, isApiError } from '@/lib/api/errors';
import { useAuth } from './_layout';
import { useRouter } from 'expo-router';
import { BrandStage, Button, GlassButton, IconButton, LanguageSwitcher, TextField, withAuthShell } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { glass, makeStyles, space, type, useTheme } from '@/lib/theme';

function LoginScreen() {
  const { session, signIn, completeGoogleSignIn } = useAuth();
  const router = useRouter();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  // The welcome screen is the landing; sign-in starts at the method picker.
  const [actionsTop, setActionsTop] = useState<number>();
  const [step, setStep] = useState<'options' | 'email_input'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Google: OAuth 2.0 runs on our server (works in Expo Go and on the web). The browser
  // comes back to the oauth-google route with a one-time code that we swap for a session.
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const returnUrl = Linking.createURL('oauth-google');
      const result = await WebBrowser.openAuthSessionAsync(authApi.googleStartUrl(returnUrl), returnUrl);
      if (result.type !== 'success') return; // closed by the user
      const params = new URL(result.url).searchParams;
      const code = params.get('code');
      if (!code) {
        const err = params.get('error');
        if (err && err !== 'cancelled') Alert.alert(tr('login.failedTitle'), apiErrorMessage(new ApiError(400, err, err), tr));
        return;
      }
      await completeGoogleSignIn(code);
      // The root navigator redirects once the session is set.
    } catch (e) {
      Alert.alert(tr('login.failedTitle'), apiErrorMessage(e, tr));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !email.includes('@')) {
      return Alert.alert(tr('login.invalidEmailTitle'), tr('login.invalidEmailBody'));
    }
    if (!password) {
      return Alert.alert(tr('login.invalidPasswordTitle'), tr('login.invalidPasswordBody'));
    }

    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
      // The root navigator redirects once the session is set.
    } catch (e) {
      if (isApiError(e, 'invalid_credentials')) {
        Alert.alert(tr('login.wrongCredsTitle'), tr('login.wrongCredsBody'), [
          { text: tr('common.retry'), style: 'cancel' },
          { text: tr('login.forgot'), onPress: () => router.push('/forgot-password') },
        ]);
      } else {
        Alert.alert(tr('login.failedTitle'), apiErrorMessage(e, tr));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDummyAction = () => {
    Alert.alert(tr('login.comingSoonTitle'), tr('login.comingSoonBody'));
  };

  if (session) {
    return (
      <View style={[s.lightScreen, s.center]}>
        <ActivityIndicator size="large" color={t.primary} />
        <Text style={[type.label, { color: t.textSecondary, marginTop: 12 }]}>{tr('login.redirecting')}</Text>
      </View>
    );
  }

  /* ---------- Method picker: black glass, logo stays where Welcome put it ---------- */
  if (step === 'options') {
    return (
      <View style={s.brandScreen}>
        {/* Same spot and size as on Welcome; no re-entrance, so the logo just stays. */}
        <BrandStage entering={false} bottom={actionsTop}>
          <Text style={s.brandTagline}>{tr('login.tagline')}</Text>
        </BrandStage>
        <SafeAreaView style={s.brandSafe}>
          <View style={s.brandTop}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
              accessibilityRole="button"
              accessibilityLabel={tr('common.back')}
              style={({ pressed }) => [s.backOnBrand, pressed && { backgroundColor: glass.fillPressed }]}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
            <LanguageSwitcher onDark />
          </View>

          <View style={{ flex: 1 }} />

          <View style={s.methods} onLayout={(e) => setActionsTop(e.nativeEvent.layout.y)}>
            <GlassButton icon="logo-google" label={tr('login.withGoogle')} onPress={handleGoogleLogin} loading={isLoading} />
            <GlassButton icon="mail" label={tr('login.withEmail')} onPress={() => setStep('email_input')} />
            <GlassButton icon="logo-apple" label={tr('login.withApple')} onPress={handleDummyAction} />
            <Pressable onPress={() => router.push('/forgot-password')} hitSlop={10} style={s.trouble} accessibilityRole="button">
              <Text style={s.troubleText}>{tr('login.trouble')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ---------- Email form: calm light/dark surface ---------- */
  const canSubmit = email.includes('@') && !!password;
  return (
    <SafeAreaView style={s.lightScreen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <IconButton icon="chevron-back" onPress={() => setStep('options')} accessibilityLabel={tr('common.back')} />

          <Text style={s.formTitle} accessibilityRole="header">
            {tr('login.emailTitle')}
          </Text>
          <Text style={s.formSubtitle}>{tr('login.emailSubtitle')}</Text>

          <View style={{ gap: space.xl, marginTop: space.lg }}>
            <TextField
              label={tr('login.emailLabel')}
              placeholder={tr('login.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              autoFocus
              returnKeyType="next"
            />
            <TextField
              label={tr('login.passwordLabel')}
              placeholder={tr('login.passwordPlaceholder')}
              secureTextEntry
              secureToggle
              autoComplete="password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && handleEmailLogin()}
            />
          </View>

          <Pressable onPress={() => router.push('/forgot-password')} hitSlop={10} style={{ marginTop: space.lg }}>
            <Text style={[type.label, { color: t.primaryText }]}>{tr('login.forgot')}</Text>
          </Pressable>
        </ScrollView>

        <View style={s.footer}>
          <Button label={tr('common.continue')} onPress={handleEmailLogin} loading={isLoading} disabled={!canSubmit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    center: { justifyContent: 'center', alignItems: 'center' },
    brandScreen: { flex: 1 },
    brandSafe: { flex: 1, paddingHorizontal: 24 },
    brandTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
    backOnBrand: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: glass.fill,
      borderWidth: 1,
      borderColor: glass.border,
      borderTopColor: glass.highlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandTagline: { ...type.subheading, color: glass.textMuted },
    methods: { gap: 12, paddingBottom: 12 },
    trouble: { alignSelf: 'center', paddingVertical: 12 },
    troubleText: { ...type.subheading, color: glass.textMuted },

    // Transparent: the black glass backdrop (withAuthShell) shows through.
    lightScreen: { flex: 1, backgroundColor: 'transparent' },
    form: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
    formTitle: { ...type.hero, color: t.text, marginTop: space.xl },
    formSubtitle: { ...type.body, color: t.textSecondary, marginTop: space.xs },
    footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'android' ? 20 : 8, paddingTop: 8 },
  }),
);

export default withAuthShell(LoginScreen);
