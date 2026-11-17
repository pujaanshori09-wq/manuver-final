import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { meApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
export default function DeleteAccountScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = inputText.trim().toUpperCase() === 'DELETE';
  const isTyping = inputText.length > 0;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    
    try {
      // Deletes the account, its data and its photos on the server.
      await meApi.deleteAccount();
      await signOut();
      Alert.alert(tr('pages.deleted'), tr('pages.deletedBody'));
    } catch (e) {
      Alert.alert(tr('pages.deleteFailed'), apiErrorMessage(e, tr));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: tr('pages.deleteTitle'),
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerBackTitle: tr('common.back')
        }} 
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            <View style={styles.centerSection}>
              <View style={styles.warningIconContainer}>
                <Ionicons name="warning" size={60} color={t.primary} />
              </View>
              
              <Text style={styles.headline}>{tr('pages.deleteQ')}</Text>
              
              <View style={styles.bodyContainer}>
                <Text style={styles.bodyText}>{tr('pages.deleteBody')}</Text>
                
                <Text style={[styles.subtitle, { marginTop: 24, marginBottom: 12, color: t.text, fontFamily: fonts.bodyBold }]}>
                  {tr('pages.typeDelete')}
                </Text>
                
                <TextInput
                  style={[
                    styles.input, 
                    isTyping && !isConfirmed && { borderColor: '#FF3B30' },
                    isConfirmed && { borderColor: t.primary }
                  ]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={tr('pages.typeDeletePh')}
                  placeholderTextColor={t.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isDeleting}
                />
              </View>
            </View>

            <View style={styles.bottomSection}>
              <TouchableOpacity accessibilityRole="button" 
                style={[
                  styles.deleteButton, 
                  !isConfirmed && styles.deleteButtonDisabled
                ]} 
                onPress={handleDelete}
                disabled={!isConfirmed || isDeleting}
                activeOpacity={0.8}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteButtonText}>{tr('pages.deleteForever')}</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity accessibilityRole="button" 
                style={styles.secondaryButton} 
                onPress={() => router.back()}
                disabled={isDeleting}
                activeOpacity={0.6}
              >
                <Text style={styles.secondaryButtonText}>{tr('pages.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: t.bg },
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
  },
  
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  warningIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: t.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: t.primary,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: t.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: t.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  
  bodyContainer: {
    width: '100%',
    backgroundColor: t.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  bodyText: {
    color: t.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bulletText: {
    color: t.textSecondary,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    paddingLeft: 8,
  },
  
  input: {
    width: '100%',
    backgroundColor: t.surface,
    borderWidth: 2,
    borderColor: t.border,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    color: t.text,
    fontFamily: fonts.display,
    fontSize: 20,
    textAlign: 'center',
  },
  
  bottomSection: {
    paddingBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#FF3B30', // Destructive red as requested
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 16 },
  
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
  },
  secondaryButtonText: { color: t.text, fontFamily: fonts.bodyBold, fontSize: 16 },
  
  deleteButton: {
    backgroundColor: '#FF3B30',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteButtonDisabled: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
}));
