import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, TextField, withAuthShell } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { makeStyles, space, type, useTheme } from '@/lib/theme';
import * as Linking from 'expo-linking';
import { authApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';

function ForgotPasswordScreen() {
  const router = useRouter();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert(tr('forgot.invalidTitle'), tr('forgot.invalidBody'));
      return;
    }

    setIsLoading(true);
    try {
      // The server answers the same whether or not the email exists.
      await authApi.forgotPassword(email.trim(), Linking.createURL('reset-password'));
      setIsSuccess(true);
    } catch (e) {
      Alert.alert(tr('forgot.failedTitle'), apiErrorMessage(e, tr));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={tr('common.back')} />

          {isSuccess && (
            <View style={s.badge}>
              <Ionicons name="mail-open-outline" size={28} color={t.primaryText} />
            </View>
          )}
          <Text style={s.title} accessibilityRole="header">
            {isSuccess ? tr('forgot.sentTitle') : tr('forgot.title')}
          </Text>
          <Text style={s.subtitle}>{isSuccess ? tr('forgot.sentSubtitle') : tr('forgot.subtitle')}</Text>

          {!isSuccess && (
            <View style={{ marginTop: space.xl }}>
              <TextField
                label={tr('forgot.emailLabel')}
                placeholder={tr('forgot.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleResetPassword}
              />
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          {isSuccess ? (
            <Button label={tr('forgot.backToLogin')} variant="secondary" onPress={() => router.push('/login')} />
          ) : (
            <Button label={tr('forgot.send')} onPress={handleResetPassword} loading={isLoading} disabled={!email.includes('@')} />
          )}
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
    badge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: space.xl,
    },
    title: { ...type.hero, color: t.text, marginTop: space.xl },
    subtitle: { ...type.body, color: t.textSecondary, marginTop: space.xs },
    footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'android' ? 20 : 8, paddingTop: 8 },
  }),
);

export default withAuthShell(ForgotPasswordScreen);
