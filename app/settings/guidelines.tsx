import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
export default function GuidelinesScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: tr('pages.guidelinesShort'),
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerBackTitle: tr('common.back')
        }} 
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>{tr('pages.guidelinesTitle')}</Text>
        <Text style={styles.subtitle}>{tr('pages.guidelinesIntro')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.g1')}</Text>
          <Text style={styles.paragraph}>{tr('pages.g1Body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.g2')}</Text>
          <Text style={styles.paragraph}>{tr('pages.g2Body')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.g3')}</Text>
          <Text style={styles.paragraph}>{tr('pages.g3Body')}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr('pages.g4')}</Text>
          <Text style={styles.paragraph}>{tr('pages.g4Body')}</Text>
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
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: t.text, marginBottom: 8 },
  paragraph: { fontFamily: fonts.body, fontSize: 15, color: t.textSecondary, lineHeight: 24 },
}));
