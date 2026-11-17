import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
const FAQ_ITEMS = [
  { q: 'pages.faq1q', a: 'pages.faq1a' },
  { q: 'pages.faq2q', a: 'pages.faq2a' },
  { q: 'pages.faq3q', a: 'pages.faq3a' },
  { q: 'pages.faq4q', a: 'pages.faq4a' },
] as const;

export default function HelpCenterScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: tr('pages.helpTitle'),
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerBackTitle: tr('common.back')
        }} 
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>{tr('pages.faq')}</Text>
        <Text style={styles.subtitle}>{tr('pages.faqSub')}</Text>

        <View style={styles.faqList}>
          {FAQ_ITEMS.map((item, index) => (
            <View key={index} style={styles.faqCard}>
              <View style={styles.qRow}>
                <Ionicons name="help-circle" size={24} color={t.primary} />
                <Text style={styles.questionText}>{tr(item.q)}</Text>
              </View>
              <Text style={styles.answerText}>{tr(item.a)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>{tr('pages.moreHelp')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: t.bg },
  scrollContent: { padding: 24, paddingBottom: 40 },
  headerTitle: { fontSize: 28, fontFamily: 'Poppins_700Bold', color: t.text, marginBottom: 8, letterSpacing: -0.6 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: t.textSecondary, marginBottom: 32, lineHeight: 22 },
  faqList: { gap: 16 },
  faqCard: {
    backgroundColor: t.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
  },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12
  },
  questionText: { fontFamily: fonts.bodyBold, fontSize: 16, color: t.text, flex: 1 },
  answerText: { fontFamily: fonts.body, fontSize: 14, color: t.textSecondary, lineHeight: 22 },
  footerInfo: {
    marginTop: 40,
    padding: 20,
    backgroundColor: t.surfaceMuted,
    borderRadius: 16,
    alignItems: 'center'
  },
  footerText: { fontFamily: fonts.body, fontSize: 13, color: t.textSecondary, textAlign: 'center', lineHeight: 20 }
}));
