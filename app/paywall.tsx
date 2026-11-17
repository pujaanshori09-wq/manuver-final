import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, GlossFill, IconButton, ProBadge } from '@/components/ui';
import { useT, type TKey } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';

type Tier = 'pro' | 'elite';

const FEATURES: Record<Tier, { icon: keyof typeof Ionicons.glyphMap; key: TKey }[]> = {
  pro: [
    { icon: 'infinite', key: 'premium.fUnlimited' },
    { icon: 'eye-outline', key: 'premium.fWhoInvited' },
    { icon: 'options-outline', key: 'premium.fSkillFilter' },
  ],
  elite: [
    { icon: 'checkmark-done', key: 'premium.fEverythingPro' },
    { icon: 'arrow-up-circle-outline', key: 'premium.fPriority' },
    { icon: 'flash-outline', key: 'premium.fBoost' },
    { icon: 'trophy-outline', key: 'premium.fTournaments' },
  ],
};

/**
 * Presentation only: no prices, no purchase, no database write.
 * "Notify me" just confirms locally until billing exists.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const params = useLocalSearchParams<{ tier?: string }>();
  const [tier, setTier] = useState<Tier>(params.tier === 'elite' ? 'elite' : 'pro');

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={s.topBar}>
        <IconButton icon="close" onPress={() => router.back()} accessibilityLabel={tr('common.close')} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title} accessibilityRole="header">
          {tr('premium.title')}
        </Text>
        <Text style={s.subtitle}>{tr('premium.subtitle')}</Text>

        <View style={s.segment} accessibilityRole="tablist">
          {(['pro', 'elite'] as Tier[]).map((k) => {
            const on = tier === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTier(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[s.segmentItem, on && s.segmentOn]}
              >
                <Text style={[s.segmentText, on && s.segmentTextOn]}>{k === 'pro' ? 'Pro' : 'Elite'}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.hero, tier === 'elite' && s.heroElite]}>
          {tier === 'pro' ? (
            <GlossFill highlight={false} />
          ) : (
            <LinearGradient colors={['#1A1A1A', '#0A0A0A']} style={StyleSheet.absoluteFill} />
          )}
          <ProBadge tier={tier} large />
          <Text style={[s.heroTitle, tier === 'elite' && { color: '#FFFFFF' }]}>
            {tier === 'pro' ? tr('premium.proTagline') : tr('premium.eliteTagline')}
          </Text>
          <View style={s.soon}>
            <Ionicons name="time-outline" size={15} color="#FFFFFF" />
            <Text style={s.soonText}>{tr('premium.comingSoon')}</Text>
          </View>
        </View>

        <View style={s.features}>
          {FEATURES[tier].map((f) => (
            <View key={f.key} style={s.feature}>
              <View style={s.featureIcon}>
                <Ionicons name={f.icon} size={20} color={t.primaryText} />
              </View>
              <Text style={s.featureText}>{tr(f.key)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Button
          label={tr('premium.notifyMe')}
          icon="notifications-outline"
          onPress={() => Alert.alert(tr('premium.notifiedTitle'), tr('premium.notifiedBody'))}
        />
        <Text style={s.footnote}>{tr('premium.footnote')}</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    topBar: { paddingHorizontal: space.md, paddingTop: space.xs },
    content: { paddingHorizontal: space.xl, paddingBottom: space.xl },
    title: { ...type.hero, color: t.text, marginTop: space.md },
    subtitle: { ...type.body, color: t.textSecondary, marginTop: space.xs },
    segment: {
      flexDirection: 'row',
      backgroundColor: t.surfaceMuted,
      borderRadius: radius.pill,
      padding: 4,
      marginTop: space.xl,
    },
    segmentItem: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    segmentOn: { backgroundColor: t.ink },
    segmentText: { ...type.label, color: t.textSecondary },
    segmentTextOn: { color: t.onInk },
    hero: {
      marginTop: space.lg,
      borderRadius: radius.sheet,
      overflow: 'hidden',
      padding: space.xl,
      minHeight: 190,
      justifyContent: 'space-between',
      gap: space.md,
    },
    heroElite: { borderWidth: 1.5, borderColor: t.primary },
    heroTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: '#FFFFFF' },
    soon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    soonText: { ...type.caption, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
    features: { marginTop: space.xl, gap: space.md },
    feature: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: { ...type.bodyStrong, color: t.text, flex: 1 },
    footer: { paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.xs, gap: space.xs },
    footnote: { ...type.caption, color: t.textMuted, textAlign: 'center' },
  }),
);
