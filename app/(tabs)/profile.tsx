import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, useTabBarInset } from '@/components/ui';
import { ProBadge } from '@/components/ui/ProBadge';
import { assetUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage, useSportName, useT } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';
import { sportIcon } from '../../components/ProfileCardSummary';

const MAX_PHOTOS = 4;
const MAX_PROMPTS = 3;

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const tabInset = useTabBarInset();
  const { me, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const sportName = useSportName();

  const [refreshing, setRefreshing] = useState(false);

  const profile = me?.profile;
  const userId = me?.id;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const photos = (me?.photos ?? []).map((ph) => assetUrl(ph.url)).slice(0, MAX_PHOTOS);
  const sports = (me?.sports ?? []).map((x) => x.sportId);
  const age = profile?.age ?? null;
  const availability = profile?.availability ?? [];
  const prompts = (me?.prompts ?? []).map((pr) => ({ question: pr.question[language === 'id' ? 'id' : 'en'], answer: pr.answer }));
  const stats = me ? { sessions: me.stats.sessionsJoined, matches: me.stats.matches } : null;

  // Completeness: the fields this app can actually edit today.
  const checks = [
    photos.length >= MAX_PHOTOS,
    !!profile?.bio,
    !!profile?.lookingFor,
    sports.length > 0,
    !!profile?.skillLevel,
    prompts.length >= MAX_PROMPTS,
  ];
  const complete = checks.every(Boolean);
  const missingPhotos = MAX_PHOTOS - photos.length;
  const missingPrompts = Math.max(0, MAX_PROMPTS - prompts.length);

  const goEdit = () => router.push('/edit-profile');
  const goPrompts = () => router.push('/edit-prompts');
  const goPaywall = () => router.push('/paywall' as any);

  const infoChips: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null; onPress?: () => void }[] = [
    { icon: 'home-outline', label: tr('profile.livingIn'), value: profile?.city },
    { icon: 'briefcase-outline', label: tr('profile.job'), value: profile?.job },
    { icon: 'school-outline', label: tr('profile.education'), value: profile?.education },
    { icon: 'trophy-outline', label: tr('profile.level'), value: profile?.skillLevel, onPress: goEdit },
    { icon: 'fitness-outline', label: tr('profile.workout'), value: profile?.workoutStyle },
  ];

  // Space for the floating upsell stack + tab bar.
  const UPSELL_HEIGHT = 150;

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.xs, paddingBottom: tabInset + UPSELL_HEIGHT + space.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        {/* Identity */}
        <View style={s.header}>
          <Pressable onPress={goEdit} accessibilityRole="button" accessibilityLabel={tr('profile.editPhotos')} style={s.stack}>
            {photos[1] ? <Image source={{ uri: photos[1] }} style={[s.stackPhoto, s.stackBack]} /> : <View style={[s.stackPhoto, s.stackBack, s.stackEmpty]} />}
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={[s.stackPhoto, s.stackFront]} />
            ) : (
              <View style={[s.stackPhoto, s.stackFront, s.stackEmpty]}>
                <Ionicons name="person" size={30} color={t.textMuted} />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1} accessibilityRole="header">
                {profile?.name || tr('profile.you')}
                {age ? <Text style={s.age}>{`, ${age}`}</Text> : null}
              </Text>
            </View>
            {userId ? (
              <Pressable
                onPress={() => router.push(`/user/${userId}` as any)}
                accessibilityRole="link"
                hitSlop={8}
                style={s.previewLink}
              >
                <Text style={s.previewText}>{tr('profile.preview')}</Text>
                <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <IconButton icon="settings-outline" onPress={() => router.push('/settings')} accessibilityLabel={tr('profile.settings')} />
        </View>

        {!complete && (
          <Pressable onPress={goEdit} accessibilityRole="button" style={({ pressed }) => [s.banner, pressed && s.pressed]}>
            <Ionicons name="alert-circle" size={22} color={t.primary} />
            <Text style={s.bannerText}>{tr('profile.complete')}</Text>
          </Pressable>
        )}

        {/* Info chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {infoChips.map((c) => {
            const filled = !!c.value;
            return (
              <Pressable
                key={c.label}
                onPress={c.onPress}
                disabled={!c.onPress}
                accessibilityRole={c.onPress ? 'button' : undefined}
                style={({ pressed }) => [s.infoChip, filled ? s.infoChipFilled : s.infoChipEmpty, pressed && s.pressed]}
              >
                <Ionicons name={c.icon} size={17} color={t.textSecondary} />
                <Text style={s.infoChipText} numberOfLines={1}>
                  {c.value || c.label}
                </Text>
                {!filled && c.onPress ? <Ionicons name="add" size={18} color={t.textSecondary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Photos */}
        <SectionTitle
          title={tr('profile.myPhotos')}
          hint={missingPhotos > 0 ? tr('profile.addMorePhotos', { n: missingPhotos }) : null}
        />
        <View style={s.card}>
          <View style={s.photoStrip}>
            {Array.from({ length: MAX_PHOTOS }).map((_, i) =>
              photos[i] ? (
                <Image key={i} source={{ uri: photos[i] }} style={s.photoSlot} />
              ) : (
                <Pressable
                  key={i}
                  onPress={goEdit}
                  accessibilityRole="button"
                  accessibilityLabel={tr('profile.addPhoto')}
                  style={[s.photoSlot, s.photoEmpty]}
                >
                  <Ionicons name="add" size={26} color={t.textSecondary} />
                </Pressable>
              ),
            )}
          </View>
          <View style={s.cardFooter}>
            <Text style={s.cardFooterText}>{tr('profile.photosHint', { n: MAX_PHOTOS })}</Text>
            <Button label={tr('common.edit')} variant="secondary" size="md" style={{ paddingHorizontal: 26 }} onPress={goEdit} />
          </View>
        </View>

        {/* Prompts */}
        <SectionTitle
          title={tr('profile.myPrompts')}
          hint={missingPrompts > 0 ? tr('profile.addMorePrompts', { n: missingPrompts }) : null}
        />
        <View style={s.grid}>
          {Array.from({ length: Math.max(2, Math.min(MAX_PROMPTS, prompts.length + 1)) }).map((_, i) => {
            const row = prompts[i];
            return (
              <Tile key={i} onPress={goPrompts} add={!row}>
                <Ionicons name="chatbubble-ellipses-outline" size={26} color={row ? t.primaryText : t.textMuted} />
                {row ? (
                  <>
                    <Text style={s.tileCaption} numberOfLines={2}>
                      {row.question}
                    </Text>
                    <Text style={s.tileValue} numberOfLines={3}>
                      {row.answer}
                    </Text>
                  </>
                ) : (
                  <Text style={s.tileEmpty}>{tr('profile.answerPrompt')}</Text>
                )}
              </Tile>
            );
          })}
        </View>

        {/* Sports cards */}
        <SectionTitle title={tr('profile.mySports')} />
        <View style={s.grid}>
          <Tile onPress={goEdit} add={!sports.length}>
            <Ionicons name={sports[0] ? sportIcon(sports[0]) : 'fitness-outline'} size={26} color={t.text} />
            <Text style={s.tileTitle}>{tr('profile.mainSport')}</Text>
            <Text style={sports.length ? s.tileSub : s.tileAdd} numberOfLines={2}>
              {sports.length ? sports.slice(0, 2).map(sportName).join(', ') + (sports.length > 2 ? ` +${sports.length - 2}` : '') : tr('profile.addSports')}
            </Text>
          </Tile>
          <Tile onPress={goEdit} add={!profile?.skillLevel}>
            <Ionicons name="trophy-outline" size={26} color={t.text} />
            <Text style={s.tileTitle}>{tr('profile.level')}</Text>
            <Text style={profile?.skillLevel ? s.tileSub : s.tileAdd}>{profile?.skillLevel || tr('profile.addLevel')}</Text>
          </Tile>
          <Tile onPress={goEdit} add={!profile?.lookingFor}>
            <Ionicons name="people-outline" size={26} color={t.text} />
            <Text style={s.tileTitle}>{tr('profile.lookingFor')}</Text>
            <Text style={profile?.lookingFor ? s.tileSub : s.tileAdd} numberOfLines={3}>
              {profile?.lookingFor || tr('profile.addLookingFor')}
            </Text>
          </Tile>
          <Tile>
            <Ionicons name="calendar-outline" size={26} color={t.text} />
            <Text style={s.tileTitle}>{tr('profile.schedule')}</Text>
            <Text style={availability.length ? s.tileSub : s.tileMuted} numberOfLines={3}>
              {availability.length ? availability.join(', ') : tr('profile.notSet')}
            </Text>
          </Tile>
          {profile?.homeVenue ? (
            <Tile>
              <Ionicons name="location-outline" size={26} color={t.text} />
              <Text style={s.tileTitle}>{tr('profile.venue')}</Text>
              <Text style={s.tileSub} numberOfLines={2}>
                {profile.homeVenue}
              </Text>
            </Tile>
          ) : null}
          <Tile>
            <Ionicons name="ribbon-outline" size={26} color={t.text} />
            <Text style={s.tileTitle}>{tr('profile.achievements')}</Text>
            {stats ? (
              <Text style={s.tileSub}>
                {tr('profile.sessionsCount', { n: stats.sessions })}
                {'\n'}
                {tr('profile.matchesCount', { n: stats.matches })}
              </Text>
            ) : (
              <Text style={s.tileMuted}>{tr('common.loading')}</Text>
            )}
          </Tile>
        </View>
      </ScrollView>

      {/* Floating upsell, as in the reference: card + counters strip above the tab bar */}
      <View pointerEvents="box-none" style={[s.upsellWrap, { bottom: tabInset }]}>
        <Pressable onPress={goPaywall} accessibilityRole="button" style={({ pressed }) => [s.upsell, pressed && s.pressed]}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={s.upsellTitleRow}>
              <Text style={s.upsellBrand}>MANUVER</Text>
              <ProBadge tier="pro" />
            </View>
            <Text style={s.upsellBody} numberOfLines={1}>
              {tr('premium.profilePitch')}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={26} color={t.text} />
        </Pressable>
        <View style={s.strip}>
          <StripItem icon="flash" label={tr('premium.boosts', { n: 0 })} onPress={goPaywall} />
          <StripItem icon="rocket" label={tr('premium.superInvites', { n: 0 })} onPress={goPaywall} />
          <StripItem icon="diamond" label={tr('premium.subscriptions')} onPress={goPaywall} />
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string | null }) {
  const s = useStyles();
  const t = useTheme();
  return (
    <View style={s.sectionHead}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {hint ? <Ionicons name="alert-circle" size={22} color={t.primary} /> : null}
      </View>
      {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function Tile({ children, onPress, add }: { children: React.ReactNode; onPress?: () => void; add?: boolean }) {
  const s = useStyles();
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.tile, pressed && s.pressed]}
    >
      {children}
      {add && onPress ? (
        <View style={s.addBadge}>
          <Ionicons name="add" size={20} color={t.onInk} />
        </View>
      ) : null}
    </Pressable>
  );
}

function StripItem({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const s = useStyles();
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6} style={({ pressed }) => [s.stripItem, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={18} color={t.primary} />
      <Text style={s.stripText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.xs },
    stack: { width: 92, height: 96 },
    stackPhoto: { position: 'absolute', width: 70, height: 88, borderRadius: 14, backgroundColor: t.surfaceMuted },
    stackBack: { left: 20, top: 2, transform: [{ rotate: '8deg' }], opacity: 0.9 },
    stackFront: { left: 2, top: 6, transform: [{ rotate: '-6deg' }], borderWidth: 2, borderColor: t.surface },
    stackEmpty: { alignItems: 'center', justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    name: { ...type.title, color: t.text, flexShrink: 1 },
    age: { fontFamily: fonts.displaySemi, color: t.textSecondary },
    previewLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, alignSelf: 'flex-start' },
    previewText: { ...type.bodyStrong, color: t.textSecondary },
    banner: {
      marginHorizontal: space.md,
      marginTop: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      minHeight: 50,
      borderRadius: radius.pill,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    bannerText: { ...type.subheading, color: t.text },
    chips: { paddingHorizontal: space.md, paddingVertical: space.md, gap: space.xs },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      height: 40,
      borderRadius: radius.pill,
      maxWidth: 220,
    },
    infoChipFilled: { backgroundColor: t.surface },
    infoChipEmpty: { backgroundColor: t.surfaceMuted },
    infoChipText: { ...type.label, color: t.text, flexShrink: 1 },
    sectionHead: { paddingHorizontal: space.lg, marginTop: space.md, marginBottom: space.sm },
    sectionTitle: { ...type.title, fontSize: 26, color: t.text },
    sectionHint: { ...type.bodyStrong, color: t.primaryText, marginTop: 2 },
    card: { marginHorizontal: space.md, backgroundColor: t.surface, borderRadius: radius.sheet - 4, padding: space.sm },
    photoStrip: { flexDirection: 'row', borderRadius: radius.card, overflow: 'hidden', gap: 2 },
    photoSlot: { flex: 1, aspectRatio: 0.72, backgroundColor: t.surfaceMuted },
    photoEmpty: { alignItems: 'center', justifyContent: 'center' },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs, paddingTop: space.md, paddingBottom: space.xs },
    cardFooterText: { ...type.callout, color: t.text, flex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: space.md, rowGap: space.sm },
    tile: {
      width: '48.2%',
      minHeight: 168,
      backgroundColor: t.surface,
      borderRadius: radius.sheet - 4,
      padding: space.md,
      gap: 6,
    },
    tileTitle: { ...type.subheading, color: t.text, marginTop: space.xs },
    tileSub: { ...type.callout, color: t.textSecondary },
    tileAdd: { ...type.callout, color: t.textSecondary },
    tileMuted: { ...type.callout, color: t.textMuted },
    tileCaption: { ...type.caption, fontFamily: fonts.bodyBold, color: t.textSecondary, marginTop: space.xs },
    tileValue: { ...type.subheading, color: t.text },
    tileEmpty: { ...type.bodyStrong, color: t.textMuted, marginTop: space.xs },
    addBadge: {
      position: 'absolute',
      top: -8,
      right: -6,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upsellWrap: { position: 'absolute', left: space.md, right: space.md, gap: space.xs, paddingBottom: space.xs },
    upsell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.sheet,
      backgroundColor: t.surface,
      borderWidth: 1.5,
      borderColor: t.primary,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: t.scheme === 'dark' ? 0.5 : 0.12,
      shadowRadius: 18,
      elevation: 8,
    },
    upsellTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    upsellBrand: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.6, color: t.text },
    upsellBody: { ...type.callout, color: t.textSecondary },
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.md,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: t.surface,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: t.scheme === 'dark' ? 0.4 : 0.08,
      shadowRadius: 14,
      elevation: 6,
    },
    stripItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    stripText: { ...type.label, fontSize: 14, color: t.text, flexShrink: 1 },
  }),
);
