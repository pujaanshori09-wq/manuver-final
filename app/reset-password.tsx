import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, TextField, withAuthShell } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { makeStyles, space, type, useTheme } from '@/lib/theme';
import { authApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';

function ResetPasswordScreen() {
  const router = useRouter();
  // Arrives from the emailed link: manuver://reset-password?token=…
  const { token } = useLocalSearchParams<{ token?: string }>();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpdatePassword = async () => {
    if (!token) {
      Alert.alert(tr('reset.failedTitle'), tr('apiErrors.invalidResetToken'));
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert(tr('reset.weakTitle'), tr('reset.weakBody'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(tr('reset.mismatchTitle'), tr('reset.mismatchBody'));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(String(token), password);
      setIsSuccess(true);
    } catch (e) {
      Alert.alert(tr('reset.failedTitle'), apiErrorMessage(e, tr));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <IconButton icon="close" onPress={() => router.push('/login')} accessibilityLabel={tr('common.close')} />

          {isSuccess && (
            <View style={s.badge}>
              <Ionicons name="checkmark" size={30} color={t.success} />
            </View>
          )}
          <Text style={s.title} accessibilityRole="header">
            {isSuccess ? tr('reset.doneTitle') : tr('reset.title')}
          </Text>
          <Text style={s.subtitle}>{isSuccess ? tr('reset.doneSubtitle') : tr('reset.subtitle')}</Text>

          {!isSuccess && (
            <View style={{ gap: space.xl, marginTop: space.xl }}>
              <TextField
                label={tr('reset.newLabel')}
                placeholder={tr('reset.newPlaceholder')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                secureToggle
                autoComplete="new-password"
                textContentType="newPassword"
                autoFocus
              />
              <TextField
                label={tr('reset.confirmLabel')}
                placeholder={tr('reset.confirmPlaceholder')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                secureToggle
                returnKeyType="go"
                onSubmitEditing={handleUpdatePassword}
              />
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          {isSuccess ? (
            <Button label={tr('reset.continue')} onPress={() => router.replace('/login')} />
          ) : (
            <Button label={tr('reset.save')} onPress={handleUpdatePassword} loading={isLoading} />
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
      backgroundColor: t.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: space.xl,
    },
    title: { ...type.hero, color: t.text, marginTop: space.xl },
    subtitle: { ...type.body, color: t.textSecondary, marginTop: space.xs },
    footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'android' ? 20 : 8, paddingTop: 8 },
  }),
);

export default withAuthShell(ResetPasswordScreen);
