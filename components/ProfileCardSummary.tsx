import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSportName, useT } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';
import { Profile } from '../types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORY_PHOTO_HEIGHT = Math.round(SCREEN_WIDTH * 1.1);

export function sportIcon(name: string): keyof typeof Ionicons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('basket')) return 'basketball-outline';
  if (lower.includes('bola') || lower.includes('futsal') || lower.includes('soccer') || lower.includes('football')) return 'football-outline';
  if (lower.includes('sepeda') || lower.includes('cycl')) return 'bicycle-outline';
  if (lower.includes('lari') || lower.includes('run')) return 'walk-outline';
  if (lower.includes('tenis') || lower.includes('tennis') || lower.includes('badminton') || lower.includes('padel')) return 'tennisball-outline';
  if (lower.includes('gym') || lower.includes('fit')) return 'barbell-outline';
  if (lower.includes('renang') || lower.includes('swim')) return 'water-outline';
  return 'fitness-outline';
}

function interestIcon(name: string): keyof typeof Ionicons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('music') || lower.includes('musik')) return 'musical-notes-outline';
  if (lower.includes('travel') || lower.includes('jalan')) return 'airplane-outline';
  if (lower.includes('food') || lower.includes('makan') || lower.includes('kuliner')) return 'restaurant-outline';
  if (lower.includes('coffee') || lower.includes('kopi')) return 'cafe-outline';
  if (lower.includes('movie') || lower.includes('film')) return 'film-outline';
  if (lower.includes('health') || lower.includes('sehat')) return 'heart-outline';
  if (lower.includes('outdoor')) return 'compass-outline';
  return 'sparkles-outline';
}

export function splitSports(hobi?: string | string[]) {
  if (!hobi) return [];
  const list = typeof hobi === 'string' ? hobi.split(',') : hobi;
  return list.map((s) => s.trim()).filter(Boolean);
}

interface Props {
  profile: Profile;
  onExpandPress?: () => void;
  /** Height of the first photo; Discover passes the card height so the photo fills it. */
  heroHeight: number;
  /** Bottom space reserved over the hero for the floating action buttons. */
  heroBottomInset?: number;
}

/**
 * The swipe card's content: a full-bleed hero photo with the essentials overlaid,
 * then the detail blocks revealed by scrolling. Rendered inside a dark ThemeScope.
 */
export default function ProfileCardSummary({ profile, onExpandPress, heroHeight, heroBottomInset = 104 }: Props) {
  const t = useTheme();
  const s = useStyles();
  const tr = useT();
  const sportName = useSportName();

  const age = profile.age ?? profile.umur;
  const sports = splitSports(profile.hobi).map(sportName);
  const heroUri = profile.photos?.[0] || profile.foto_url;
  const distance =
    profile.distance !== undefined && profile.distance !== null
      ? tr('discover.kmAway', { n: profile.distance })
      : profile.jarak || null;
  const prompt = profile.prompt_answer || null;
  const availability = profile.availability ?? [];
  const interests = profile.interests ?? [];

  return (
    <View>
      {/* Hero */}
      <View style={[s.hero, { height: heroHeight }]}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.noPhoto]}>
            <Ionicons name="person" size={72} color={t.textMuted} />
          </View>
        )}

        <View style={s.lookingPill}>
          <View style={s.liveDot} />
          <Text style={s.lookingText}>{tr('discover.lookingFor')}</Text>
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.94)']}
          locations={[0, 0.45, 1]}
          style={[s.heroOverlay, { paddingBottom: heroBottomInset }]}
        >
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityRole="header">
              {profile.nama}
              {age ? <Text style={s.age}>{`  ${age}`}</Text> : null}
            </Text>
            <Ionicons name="checkmark-circle" size={22} color={t.onPhoto} accessibilityLabel={tr('discover.photoVerified')} />
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onExpandPress}
              accessibilityRole="button"
              accessibilityLabel={tr('discover.moreInfo')}
              hitSlop={8}
              style={({ pressed }) => [s.infoBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="arrow-up" size={22} color="#111111" />
            </Pressable>
          </View>

          {(profile.alamat || distance) && (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={17} color="rgba(255,255,255,0.86)" />
              <Text style={s.metaText} numberOfLines={1}>
                {[distance, profile.alamat].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          {sports.length > 0 && (
            <View style={s.heroSports}>
              {sports.slice(0, 3).map((sport) => (
                <View key={sport} style={s.heroChip}>
                  <Ionicons name={sportIcon(sport)} size={14} color={t.onPhoto} />
                  <Text style={s.heroChipText}>{sport}</Text>
                </View>
              ))}
              {sports.length > 3 && (
                <View style={s.heroChip}>
                  <Text style={s.heroChipText}>+{sports.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Details revealed on scroll */}
      <View style={s.body}>
        {(prompt || profile.bio) && (
          <View style={s.block}>
            <Text style={s.blockLabel}>{profile.prompt_question || tr('discover.aboutMe')}</Text>
            <Text style={s.promptText}>{prompt || profile.bio}</Text>
            {profile.bio && prompt ? (
              <>
                <View style={s.divider} />
                <Text style={s.blockLabel}>{tr('discover.aboutMe')}</Text>
                <Text style={s.bodyText}>{profile.bio}</Text>
              </>
            ) : null}
          </View>
        )}

        {sports.length > 0 && (
          <View style={s.block}>
            <Text style={s.blockLabel}>{tr('discover.mainSports')}</Text>
            <View style={s.wrapRow}>
              {sports.map((sport) => (
                <View key={sport} style={s.chip}>
                  <Ionicons name={sportIcon(sport)} size={15} color={t.primaryText} />
                  <Text style={s.chipText}>{sport}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {profile.photos?.[1] ? (
          <View style={s.story}>
            <Image source={{ uri: profile.photos[1] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {profile.alamat ? (
              <LinearGradient colors={['transparent', 'rgba(10,10,10,0.85)']} style={s.storyCaption}>
                <Ionicons name="pin-outline" size={14} color={t.onPhoto} />
                <Text style={s.storyCaptionText}>{tr('discover.oftenTrains', { place: profile.alamat })}</Text>
              </LinearGradient>
            ) : null}
          </View>
        ) : null}

        {(profile.skill_level || profile.distance_pref || availability.length > 0) && (
          <View style={s.block}>
            <Text style={s.blockLabel}>{tr('discover.scheduleTitle')}</Text>
            <View style={s.statRow}>
              {profile.skill_level ? (
                <Stat icon="trophy-outline" label={tr('discover.skillLevel')} value={profile.skill_level} />
              ) : null}
              {profile.distance_pref ? (
                <Stat icon="navigate-outline" label={tr('discover.maxDistance')} value={profile.distance_pref} />
              ) : null}
            </View>
            {availability.length > 0 && (
              <>
                <Text style={[s.statLabel, { marginTop: space.md }]}>{tr('discover.availability')}</Text>
                <View style={s.wrapRow}>
                  {availability.map((time) => (
                    <View key={time} style={s.chipMuted}>
                      <Ionicons name="time-outline" size={14} color={t.textSecondary} />
                      <Text style={s.chipText}>{time}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {profile.photos?.[2] ? (
          <View style={s.story}>
            <Image source={{ uri: profile.photos[2] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ) : null}

        {interests.length > 0 && (
          <View style={s.block}>
            <Text style={s.blockLabel}>{tr('discover.interests')}</Text>
            <View style={s.wrapRow}>
              {interests.map((interest) => (
                <View key={interest} style={s.chipMuted}>
                  <Ionicons name={interestIcon(interest)} size={14} color={t.textSecondary} />
                  <Text style={s.chipText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const t = useTheme();
  const s = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.statValue}>
        <Ionicons name={icon} size={16} color={t.primaryText} />
        <Text style={s.chipText} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    hero: { width: '100%', backgroundColor: t.surface },
    noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceMuted },
    lookingPill: {
      position: 'absolute',
      top: 14,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: t.photoScrim,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.primary },
    lookingText: { ...type.caption, fontFamily: fonts.bodyBold, color: t.onPhoto },
    heroOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.lg,
      paddingTop: 120,
      gap: space.xs,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    name: { ...type.hero, fontSize: 32, color: t.onPhoto, flexShrink: 1 },
    age: { fontFamily: fonts.displaySemi, fontSize: 28, color: 'rgba(255,255,255,0.9)' },
    infoBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { ...type.callout, color: 'rgba(255,255,255,0.86)', flexShrink: 1 },
    heroSports: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroChipText: { ...type.caption, fontFamily: fonts.bodyBold, color: t.onPhoto },

    body: { padding: space.sm, gap: space.sm, backgroundColor: t.bg },
    block: { backgroundColor: t.surface, borderRadius: radius.card + 4, padding: space.lg, gap: space.xs },
    blockLabel: { ...type.label, fontSize: 14, color: t.textSecondary },
    promptText: { ...type.heading, fontSize: 21, lineHeight: 29, color: t.text },
    bodyText: { ...type.body, color: t.text },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: space.xs },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: t.primarySoft,
    },
    chipMuted: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: t.surfaceMuted,
    },
    chipText: { ...type.label, fontSize: 14, color: t.text },
    story: {
      width: '100%',
      height: STORY_PHOTO_HEIGHT,
      borderRadius: radius.card + 4,
      overflow: 'hidden',
      backgroundColor: t.surface,
    },
    storyCaption: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      paddingTop: space.xxl,
    },
    storyCaptionText: { ...type.label, fontSize: 14, color: t.onPhoto },
    statRow: { flexDirection: 'row', gap: space.sm },
    statLabel: { ...type.caption, color: t.textMuted, marginBottom: 6 },
    statValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: t.surfaceMuted,
    },
  }),
);
