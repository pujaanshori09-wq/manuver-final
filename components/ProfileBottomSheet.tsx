import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlossFill, glossShadow, IconButton } from '@/components/ui';
import { useSportName, useT } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, ThemeScope, type, useTheme, type Theme } from '@/lib/theme';
import { FREQUENCY_OPTIONS, PREFERRED_TIME_OPTIONS, SPORT_ROLE_OPTIONS } from '../constants/ProfileOptions';
import { Profile } from '../types/database';
import PhotoCarousel from './PhotoCarousel';
import { sportIcon, splitSports } from './ProfileCardSummary';

const { height } = Dimensions.get('window');

interface ProfileBottomSheetProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSwipeAction?: (action: 'left' | 'right' | 'up') => void;
}

/** Full profile opened from the Discover card. Always dark, like Discover. */
export default function ProfileBottomSheet(props: ProfileBottomSheetProps) {
  if (!props.profile) return null;
  return (
    <Modal visible={props.visible} animationType="slide" transparent={false} onRequestClose={props.onClose}>
      <ThemeScope scheme="dark">
        <Sheet {...props} profile={props.profile} />
      </ThemeScope>
    </Modal>
  );
}

function Sheet({ profile, onClose, onSwipeAction }: ProfileBottomSheetProps & { profile: Profile }) {
  const tr = useT();
  const sportName = useSportName();
  const th = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();

  const matchPercentage =
    profile.match_percentage !== undefined
      ? profile.match_percentage
      : profile.match_score
        ? Math.round(Math.min((profile.match_score / 130) * 100, 100))
        : 0;

  const allPhotos: string[] =
    profile.photos && profile.photos.length > 0 ? profile.photos : profile.foto_url ? [profile.foto_url] : [];
  const age = profile.age ?? profile.umur;
  const place = profile.domisili || profile.alamat;
  const km = profile.distance_km ?? profile.distance;
  const distance = km !== undefined && km !== null ? (km < 1 ? '< 1 km' : `${Math.round(km)} km`) : profile.jarak || null;
  const fromRelation = (profile.user_sports ?? []).map((us) => us.sports?.nama).filter(Boolean) as string[];
  const sports = (fromRelation.length ? fromRelation : splitSports(profile.hobi)).map(sportName);
  const frequency = profile.overall_frequency
    ? FREQUENCY_OPTIONS.find((f) => f.value === profile.overall_frequency)?.label || profile.overall_frequency
    : null;
  const time = profile.preferred_time
    ? PREFERRED_TIME_OPTIONS.find((o) => o.value === profile.preferred_time)?.label || profile.preferred_time
    : null;
  const role = profile.sport_role
    ? SPORT_ROLE_OPTIONS.find((r) => r.value === profile.sport_role)?.label || profile.sport_role
    : null;
  const prefs = [
    frequency && { icon: 'calendar-outline' as const, label: tr('sheets.plays'), value: frequency },
    time && { icon: 'time-outline' as const, label: tr('sheets.prefers'), value: time },
    profile.home_venue && { icon: 'location-outline' as const, label: tr('sheets.homeCourt'), value: profile.home_venue },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[];

  const ACTION_BAR = 96 + insets.bottom;

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: ACTION_BAR + space.md }} showsVerticalScrollIndicator={false}>
        {allPhotos.length > 0 && (
          <View style={s.photo}>
            <PhotoCarousel photos={allPhotos} />
          </View>
        )}

        <View style={s.body}>
          <View style={s.nameRow}>
            <Text style={s.name} accessibilityRole="header">
              {profile.nama}
              {age ? <Text style={s.age}>{`  ${age}`}</Text> : null}
            </Text>
            {profile.profile_completeness !== undefined && profile.profile_completeness >= 80 && (
              <Ionicons name="checkmark-circle" size={24} color={th.text} accessibilityLabel={tr('discover.photoVerified')} />
            )}
          </View>

          {(place || distance) && (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={17} color={th.textSecondary} />
              <Text style={s.metaText}>{[distance, place].filter(Boolean).join(' · ')}</Text>
            </View>
          )}

          <View style={s.chips}>
            {matchPercentage >= 60 && (
              <View style={[s.chip, s.chipGloss]}>
                <GlossFill highlight={false} />
                <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                <Text style={[s.chipText, { color: '#FFFFFF' }]}>{tr('sheets.matchPct', { n: matchPercentage })}</Text>
              </View>
            )}
            {!!profile.skill_level && (
              <View style={s.chip}>
                <Ionicons name="trophy-outline" size={14} color={th.text} />
                <Text style={s.chipText}>{profile.skill_level}</Text>
              </View>
            )}
            {role && (
              <View style={s.chip}>
                <Ionicons name="ribbon-outline" size={14} color={th.text} />
                <Text style={s.chipText}>{role}</Text>
              </View>
            )}
            {!!profile.height_cm && (
              <View style={s.chip}>
                <Ionicons name="resize-outline" size={14} color={th.text} />
                <Text style={s.chipText}>{profile.height_cm} cm</Text>
              </View>
            )}
          </View>

          {!!profile.bio && (
            <Section title={tr('sheets.aboutMe')}>
              <Text style={s.bio}>{profile.bio}</Text>
            </Section>
          )}

          {sports.length > 0 && (
            <Section title={tr('sheets.favSports')}>
              <View style={s.chips}>
                {sports.map((name) => (
                  <View key={name} style={[s.chip, s.sportChip]}>
                    <Ionicons name={sportIcon(name)} size={16} color={th.primaryText} />
                    <Text style={s.chipText}>{name}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {profile.prompts && profile.prompts.length > 0 && (
            <Section title={tr('sheets.prompts')}>
              {profile.prompts.map((p, idx) => (
                <View key={idx} style={s.prompt}>
                  <Text style={s.promptQ}>{p.question_text}</Text>
                  <Text style={s.promptA}>{p.answer_text}</Text>
                </View>
              ))}
            </Section>
          )}

          {prefs.length > 0 && (
            <Section title={tr('sheets.activity')}>
              <View style={s.card}>
                {prefs.map((row, i) => (
                  <View key={row.label} style={[s.prefRow, i > 0 && s.prefDivider]}>
                    <View style={s.prefIcon}>
                      <Ionicons name={row.icon} size={18} color={th.primaryText} />
                    </View>
                    <Text style={s.prefLabel}>{row.label}</Text>
                    <Text style={s.prefValue} numberOfLines={1}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          )}
        </View>
      </ScrollView>

      {/* Close sits over the photo, clear of the status bar */}
      <View style={[s.closeWrap, { top: insets.top + space.xs }]}>
        <IconButton icon="chevron-down" onPress={onClose} accessibilityLabel={tr('common.close')} style={s.closeBtn} />
      </View>

      {/* Same action set as the Discover card */}
      <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Pressable
          onPress={() => onSwipeAction?.('left')}
          accessibilityRole="button"
          accessibilityLabel={tr('discover.pass')}
          style={({ pressed }) => [s.action, s.pass, pressed && s.pressed]}
        >
          <Ionicons name="close" size={32} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={() => onSwipeAction?.('up')}
          accessibilityRole="button"
          accessibilityLabel={tr('discover.super')}
          style={({ pressed }) => [s.superBtn, pressed && s.pressed]}
        >
          <Ionicons name="flash" size={22} color={th.primaryText} />
        </Pressable>
        <Pressable
          onPress={() => onSwipeAction?.('right')}
          accessibilityRole="button"
          accessibilityLabel={tr('discover.like')}
          style={({ pressed }) => [s.action, glossShadow, pressed && s.pressed]}
        >
          <View style={s.likeClip}>
            <GlossFill />
          </View>
          <MaterialIcons name="directions-run" size={34} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((th: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: th.bg },
    photo: { width: '100%', height: height * 0.56, backgroundColor: th.surfaceMuted },
    body: { paddingHorizontal: space.lg, paddingTop: space.lg },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    name: { ...type.hero, color: th.text, flexShrink: 1 },
    age: { fontFamily: fonts.displaySemi, fontSize: 28, color: th.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
    metaText: { ...type.callout, color: th.textSecondary, flexShrink: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: th.surfaceMuted,
      overflow: 'hidden',
    },
    chipGloss: { backgroundColor: 'transparent' },
    sportChip: { backgroundColor: th.primarySoft },
    chipText: { ...type.label, fontSize: 14, color: th.text },
    section: { marginTop: space.xl },
    sectionTitle: { ...type.heading, color: th.text, marginBottom: space.sm },
    bio: { ...type.body, fontSize: 17, lineHeight: 25, color: th.text },
    prompt: { backgroundColor: th.surface, borderRadius: radius.card + 4, padding: space.lg, marginBottom: space.sm, gap: 6 },
    promptQ: { ...type.label, fontSize: 14, color: th.textSecondary },
    promptA: { ...type.heading, fontSize: 21, lineHeight: 28, color: th.text },
    card: { backgroundColor: th.surface, borderRadius: radius.card + 4, overflow: 'hidden' },
    prefRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 14 },
    prefDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: th.border },
    prefIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: th.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prefLabel: { ...type.callout, color: th.textSecondary },
    prefValue: { ...type.bodyStrong, color: th.text, flex: 1, textAlign: 'right' },
    closeWrap: { position: 'absolute', left: space.md },
    closeBtn: { backgroundColor: 'rgba(10,10,10,0.6)' },
    actions: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xl,
      paddingTop: space.md,
      backgroundColor: 'rgba(10,10,10,0.92)',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: th.border,
    },
    action: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    pass: { backgroundColor: th.surface, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
    superBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.surface,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    likeClip: { ...StyleSheet.absoluteFill, borderRadius: 32, overflow: 'hidden' },
    pressed: { transform: [{ scale: 0.94 }] },
  }),
);
