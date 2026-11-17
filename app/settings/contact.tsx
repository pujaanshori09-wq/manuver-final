import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
export default function ContactUsScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert(tr('pages.error'), tr('pages.fillAll'));
      return;
    }
    
    // Simulate sending message
    Alert.alert(
      tr('pages.sent'), 
      tr('pages.sentBody'),
      [{ text: tr('common.ok'), onPress: () => router.back() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: tr('pages.contactTitle'),
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerBackTitle: tr('common.back')
        }} 
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.headerTitle}>{tr('pages.howHelp')}</Text>
          <Text style={styles.subtitle}>{tr('pages.howHelpBody')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{tr('pages.subject')}</Text>
            <TextInput 
              style={styles.input} 
              placeholder={tr('pages.subjectPh')} 
              placeholderTextColor={t.textSecondary}
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{tr('pages.message')}</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder={tr('pages.messagePh')} 
              placeholderTextColor={t.textSecondary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
          </View>

          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{tr('pages.send')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: t.bg },
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  headerTitle: { fontFamily: fonts.display, fontSize: 28, color: t.text, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: t.textSecondary, marginBottom: 32, lineHeight: 22 },
  inputGroup: { marginBottom: 24 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: t.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    padding: 16,
    color: t.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  textArea: {
    minHeight: 150,
  },
  button: {
    backgroundColor: t.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: t.text, fontFamily: fonts.bodyBold, fontSize: 16 }
}));
