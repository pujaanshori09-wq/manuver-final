import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, TextField, withAuthShell } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';
import { apiErrorMessage, isApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';

function RegisterScreen() {
  const router = useRouter();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    // 1. Validation
    setErrorMsg(null);
    if (!fullName.trim()) return setErrorMsg(tr('register.errName'));
    if (!email.trim() || !email.includes('@')) return setErrorMsg(tr('register.errEmail'));
    if (!password) return setErrorMsg(tr('register.errPasswordEmpty'));
    if (password.length < 8) return setErrorMsg(tr('register.errPasswordShort'));
    if (password !== confirmPassword) return setErrorMsg(tr('register.errPasswordMatch'));

    setIsLoading(true);

    try {
      await signUp(email.trim(), password, fullName.trim());
      // Signed in: the root navigator continues to onboarding.
    } catch (e) {
      setErrorMsg(isApiError(e, 'email_taken') ? tr('register.errEmailTaken') : apiErrorMessage(e, tr));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={tr('common.back')} />

          <Text style={s.title} accessibilityRole="header">
            {tr('register.title')}
          </Text>
          <Text style={s.subtitle}>{tr('register.subtitle')}</Text>

          {errorMsg && (
            <View style={s.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={20} color={t.danger} />
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={s.fields}>
            <TextField
              label={tr('register.nameLabel')}
              placeholder={tr('register.namePlaceholder')}
              value={fullName}
              onChangeText={setFullName}
              editable={!isLoading}
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label={tr('register.emailLabel')}
              placeholder={tr('register.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
            />
            <TextField
              label={tr('register.passwordLabel')}
              placeholder={tr('register.passwordPlaceholder')}
              secureTextEntry
              secureToggle
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />
            <TextField
              label={tr('register.confirmLabel')}
              placeholder={tr('register.confirmPlaceholder')}
              secureTextEntry
              secureToggle
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isLoading}
              returnKeyType="go"
              onSubmitEditing={handleRegister}
            />
          </View>

          <View style={s.footerRow}>
            <Text style={[type.callout, { color: t.textSecondary }]}>{tr('register.haveAccount')} </Text>
            <Pressable onPress={() => router.push('/login')} disabled={isLoading} hitSlop={10} accessibilityRole="link">
              <Text style={[type.label, { color: t.primaryText }]}>{tr('register.signIn')}</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Button label={tr('register.submit')} onPress={handleRegister} loading={isLoading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    // Transparent: the black glass backdrop (withAuthShell) shows through.
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
    title: { ...type.hero, color: t.text, marginTop: space.xl },
    subtitle: { ...type.body, color: t.textSecondary, marginTop: space.xs },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.dangerSoft,
      borderRadius: radius.md,
      padding: 14,
      marginTop: space.xl,
    },
    errorText: { ...type.callout, color: t.danger, flex: 1 },
    fields: { gap: space.xl, marginTop: space.xl },
    hint: { ...type.caption, color: t.textSecondary },
    footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: space.xxl },
    footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'android' ? 20 : 8, paddingTop: 8 },
  }),
);

export default withAuthShell(RegisterScreen);
