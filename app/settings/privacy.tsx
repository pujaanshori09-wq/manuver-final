import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
export default function PrivacyScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: tr('pages.privacyTitle'),
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerBackTitle: tr('common.back')
        }} 
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>{tr('pages.privacyTitle')}</Text>
        <Text style={styles.subtitle}>{tr('pages.privacyUpdated')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.p1')}</Text>
          <Text style={styles.paragraph}>{tr('pages.p1Body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.p2')}</Text>
          <Text style={styles.paragraph}>{tr('pages.p2Body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.p3')}</Text>
          <Text style={styles.paragraph}>{tr('pages.p3Body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.p4')}</Text>
          <Text style={styles.paragraph}>{tr('pages.p4Body')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: t.bg },
  scrollContent: { padding: 24, paddingBottom: 40 },
  headerTitle: { fontFamily: fonts.display, fontSize: 28, color: t.text, marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: t.textSecondary, marginBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: t.text, marginBottom: 8 },
  paragraph: { fontFamily: fonts.body, fontSize: 14, color: t.textSecondary, lineHeight: 22 },
}));
