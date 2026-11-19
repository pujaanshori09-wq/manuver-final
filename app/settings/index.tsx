import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlossFill, IconButton, ListRow, ListSection, ProBadge } from '@/components/ui';
import { LANGUAGES, toAccountLanguage, useLanguage, useT } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { LanguageWheel } from '@/components/LanguageWheel';
import { meApi } from '@/lib/api';
import type { Language } from '@/lib/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const { language, setLanguage } = useLanguage();
  const { signOut, setMe } = useAuth();
  const [wheelOpen, setWheelOpen] = useState(false);

  // Switch immediately; save to the account in the background so other devices follow.
  const changeLanguage = (l: Language) => {
    setLanguage(l);
    meApi.updateProfile({ language: toAccountLanguage(l) }).then(setMe).catch(() => {});
  };

  const handleLogout = async () => {
    Alert.alert(tr('settings.logoutTitle'), tr('settings.logoutBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          // The root navigator sends a signed-out user to the welcome screen.
          await signOut();
        },
      },
    ]);
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={{ width: 44 }} />
        <Text style={s.headerTitle} accessibilityRole="header">
          {tr('settings.title')}
        </Text>
        <IconButton icon="checkmark" variant="ink" onPress={() => router.back()} accessibilityLabel={tr('common.done')} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        {/* Premium tiers */}
        <TierCard tier="pro" onPress={() => router.push('/paywall?tier=pro' as any)} />
        <TierCard tier="elite" onPress={() => router.push('/paywall?tier=elite' as any)} />

        <ListSection title={tr('settings.discovery')}>
          <ListRow
            icon="options-outline"
            label={tr('settings.discoverySettings')}
            description={tr('settings.discoveryHint')}
            onPress={() => router.push('/settings/filters')}
            chevron
          />
        </ListSection>

        <ListSection>
          <ListRow
            icon="language-outline"
            label={tr('language.title')}
            value={LANGUAGES.find((l) => l.code === language)?.native}
            onPress={() => setWheelOpen(true)}
            chevron
          />
        </ListSection>

        <ListSection title={tr('settings.contactUs')}>
          <ListRow label={tr('settings.help')} onPress={() => router.push('/settings/help')} chevron />
          <ListRow label={tr('settings.contact')} onPress={() => router.push('/settings/contact')} chevron />
        </ListSection>

        <ListSection title={tr('settings.community')}>
          <ListRow label={tr('settings.guidelines')} onPress={() => router.push('/settings/guidelines')} chevron />
          <ListRow label={tr('settings.safety')} onPress={() => router.push('/settings/safety')} chevron />
        </ListSection>

        <ListSection title={tr('settings.legal')}>
          <ListRow label={tr('settings.privacy')} onPress={() => router.push('/settings/privacy')} chevron />
          <ListRow label={tr('settings.terms')} onPress={() => router.push('/settings/terms')} chevron />
        </ListSection>

        <ListSection>
          <ListRow label={tr('settings.logout')} centered onPress={handleLogout} />
        </ListSection>
        <ListSection>
          <ListRow label={tr('settings.deleteAccount')} centered destructive onPress={() => router.push('/settings/delete-account')} />
        </ListSection>

        <View style={s.footer}>
          <Ionicons name="flame" size={24} color={t.primary} />
          <Text style={s.version}>{tr('settings.version', { v: '1.0.4' })}</Text>
        </View>
      </ScrollView>

      <LanguageWheel
        visible={wheelOpen}
        value={language}
        onSelect={(l) => l !== language && changeLanguage(l)}
        onClose={() => setWheelOpen(false)}
      />
    </View>
  );
}

function TierCard({ tier, onPress }: { tier: 'pro' | 'elite'; onPress: () => void }) {
  const tr = useT();
  const s = useStyles();
  const pro = tier === 'pro';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.tier, !pro && s.tierElite, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      {pro ? <GlossFill highlight={false} /> : <LinearGradient colors={['#1C1C1C', '#0A0A0A']} style={StyleSheet.absoluteFill} />}
      <View style={s.tierTop}>
        <Text style={s.tierBrand}>MANUVER</Text>
        <ProBadge tier={tier} />
      </View>
      <Text style={s.tierBody}>{pro ? tr('premium.proTagline') : tr('premium.eliteTagline')}</Text>
      <View style={s.tierCta}>
        <Text style={s.tierCtaText}>{tr('premium.seeIncluded')}</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.md,
    },
    headerTitle: { ...type.heading, color: t.text },
    content: { paddingHorizontal: space.md, paddingTop: space.xs, gap: space.sm },
    tier: {
      borderRadius: radius.sheet - 4,
      overflow: 'hidden',
      padding: space.lg,
      gap: space.xs,
    },
    tierElite: { borderWidth: 1.5, borderColor: t.primary },
    tierTop: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    tierBrand: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.6, color: '#FFFFFF' },
    tierBody: { ...type.bodyStrong, color: '#FFFFFF' },
    tierCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    tierCtaText: { ...type.label, color: '#FFFFFF', textDecorationLine: 'underline' },
    footer: { alignItems: 'center', gap: 4, marginTop: space.lg },
    version: { ...type.caption, color: t.textSecondary },
  }),
);
