import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
export default function SafetyScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: tr('pages.safetyTitle'),
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerBackTitle: tr('common.back')
        }} 
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>{tr('pages.safetyFirst')}</Text>
        <Text style={styles.subtitle}>{tr('pages.safetyIntro')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.offline')}</Text>
          <Text style={styles.paragraph}>{tr('pages.offline1')}</Text>
          <Text style={styles.paragraph}>{tr('pages.offline2')}</Text>
          <Text style={styles.paragraph}>{tr('pages.offline3')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.data')}</Text>
          <Text style={styles.paragraph}>{tr('pages.dataBody')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.report')}</Text>
          <Text style={styles.paragraph}>{tr('pages.reportBody')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: t.bg },
  scrollContent: { padding: 24, paddingBottom: 40 },
  headerTitle: { fontFamily: fonts.display, fontSize: 28, color: t.text, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: t.textSecondary, marginBottom: 32, lineHeight: 22 },
  section: { marginBottom: 24, backgroundColor: t.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: t.border },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: t.primary, marginBottom: 12 },
  paragraph: { fontFamily: fonts.body, fontSize: 14, color: t.text, lineHeight: 22, marginBottom: 8 },
}));
