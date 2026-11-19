import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
// shortcut: block and report still go through Supabase until stage 6 moves them to the new API.
import { assetUrl, safetyApi, usersApi, type ReportReason } from '@/lib/api';
import { ProfileActivities } from '../../components/ProfileActivities';

import { useTheme, makeStyles, type Theme, fonts, space, radius } from '@/lib/theme';
import { useLanguage, useSportName, useT, type TKey } from '@/lib/i18n';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_PHOTO_HEIGHT = Math.round(SCREEN_WIDTH * 1.25);

type PublicProfile = {
  id: string;
  nama: string | null;
  umur: number | null;
  foto_url: string | null;
  photos: string[] | null;
  bio: string | null;
  skill_level: string | null;
  pekerjaan: string | null;
  domisili: string | null;
  looking_for: string | null;
  preferred_time: string | null;
  home_venue: string | null;
  sports: { sport_id: string; experience_level: string | null }[];
  prompts: { question_text: string; answer_text: string }[];
};

// Stored experience ids (see onboarding) → translation keys.
const EXPERIENCE_KEYS: Record<string, TKey> = {
  '< 6 bln': 'experience.lt6m',
  '6 bln-1 thn': 'experience.m6to1y',
  '1-3 thn': 'experience.y1to3',
  '3+ thn': 'experience.y3plus', // older accounts
  '3-6 thn': 'experience.y3to6',
  '6+ thn': 'experience.y6plus',
};

export default function UserDetailScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sportName = useSportName();
  // `id` is the other player's profile id (chat passes partnerId).
  const { id, name, avatar } = useLocalSearchParams();

  const { language } = useLanguage();
  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['public-profile', id],
    enabled: !!id,
    // Only matched players can open a profile (the server answers 404 otherwise).
    queryFn: async (): Promise<PublicProfile & { activities: Awaited<ReturnType<typeof usersApi.get>>['activities'] }> => {
      const p = await usersApi.get(id as string);
      return {
        id: p.id,
        nama: p.name,
        umur: p.age,
        foto_url: null,
        photos: p.photos.map((u) => assetUrl(u)).filter((u): u is string => !!u),
        bio: p.bio,
        skill_level: p.skillLevel,
        pekerjaan: p.job,
        domisili: p.city,
        looking_for: p.lookingFor,
        preferred_time: p.preferredTime,
        home_venue: p.homeVenue,
        sports: p.sports.map((sp) => ({ sport_id: sp.sportId, experience_level: sp.experienceLevel })),
        prompts: p.prompts.map((pr) => ({ question_text: language === 'id' ? pr.question.id : pr.question.en, answer_text: pr.answer })),
        activities: p.activities,
      };
    },
  });

  // Real data from the server; the route params only fill the name/photo while loading.
  const photos: string[] =
    profile?.photos && profile.photos.length > 0
      ? profile.photos
      : profile?.foto_url
        ? [profile.foto_url]
        : avatar
          ? [avatar as string]
          : [];
  const user = {
    nama: profile?.nama || (name as string) || '',
    umur: profile?.umur ?? null,
    alamat: profile?.domisili || null,
    bio: profile?.bio || null,
    photos,
    sports: profile?.sports ?? [],
    prompts: profile?.prompts ?? [],
    preferred_time: profile?.preferred_time || null,
    favorite_venue: profile?.home_venue || null,
  };

  const executeBlock = async () => {
    try {
      await safetyApi.block(String(id));
      Alert.alert(tr('userProfile.blockedTitle'), tr('userProfile.blockedBody', { name: user.nama }));
      router.back();
    } catch (e: any) {
      Alert.alert(tr('userProfile.blockError'), e.message);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      tr('userProfile.blockConfirmTitle'),
      tr('userProfile.blockBody', { name: user.nama }),
      [
        { text: tr('userProfile.cancel'), style: 'cancel' },
        { text: tr('userProfile.blockYes'), style: 'destructive', onPress: executeBlock },
      ]
    );
  };

  const executeReport = async (reason: ReportReason) => {
    try {
      await safetyApi.report(String(id), reason);
      Alert.alert(tr('userProfile.reportThanksTitle'), tr('userProfile.reportThanksBody'));
    } catch (e: any) {
      Alert.alert(tr('userProfile.reportError'), e.message);
    }
  };

  const handleReportFlow = () => {
    Alert.alert(tr('userProfile.reportTitle'), tr('userProfile.reportBody', { name: user.nama }), [
      { text: tr('userProfile.cancel'), style: 'cancel' },
      { text: tr('userProfile.reasonRude'), onPress: () => executeReport('RUDE') },
      { text: tr('userProfile.reasonSpam'), onPress: () => executeReport('SPAM') },
    ]);
  };

  const handleMoreOptions = () => {
    Alert.alert(tr('userProfile.safetyTitle'), tr('userProfile.safetyBody'), [
      { text: tr('userProfile.cancel'), style: 'cancel' },
      { text: tr('userProfile.report'), onPress: handleReportFlow },
      { text: tr('userProfile.block'), style: 'destructive', onPress: confirmBlock },
    ]);
  };

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="auto" />

      {/* Floating Top Back & Report Controls */}
      <View style={[styles.floatingNav, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.circleIconBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={tr('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={'#FFFFFF'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.circleIconBtn}
          onPress={handleMoreOptions}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={tr('userProfile.safetyTitle')}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={'#FFFFFF'} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : error || !profile ? (
        <View style={styles.stateWrap}>
          <Ionicons name="person-circle-outline" size={56} color={t.textMuted} />
          <Text style={styles.stateTitle}>{tr('userProfile.loadFailed')}</Text>
          <TouchableOpacity style={styles.stateBtn} onPress={() => refetch()} accessibilityRole="button">
            <Text style={styles.stateBtnText}>{tr('chatRoom.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Main Hero Photo */}
        <View style={styles.heroContainer}>
          {user.photos[0] ? (
            <Image source={{ uri: user.photos[0] }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.noPhoto]}>
              <Ionicons name="person" size={72} color={t.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['rgba(11, 13, 19, 0.4)', 'transparent', 'rgba(11, 13, 19, 0.95)', t.bg]}
            locations={[0, 0.45, 0.85, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.heroNameText}>
                {user.umur ? `${user.nama}, ${user.umur}` : user.nama}
              </Text>
              <View style={styles.verifiedCheck}>
                <Ionicons name="checkmark-sharp" size={13} color="#FFFFFF" />
              </View>
            </View>
            {user.alamat ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={14} color={t.primary} />
                <Text style={styles.locationText}>{user.alamat}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Bio & About Me */}
        {user.bio ? (
          <View style={styles.bodySection}>
            <Text style={styles.sectionHeading}>{tr('userProfile.about')}</Text>
            <Text style={styles.bioBody}>{user.bio}</Text>
          </View>
        ) : null}

        {user.prompts.length > 0 ? (
          <View style={styles.bodySection}>
            {user.prompts.map((p, idx) => (
              <View key={idx} style={styles.promptCard}>
                <Text style={styles.promptQ}>{p.question_text}</Text>
                <Text style={styles.promptA}>{p.answer_text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Sports & Skill Matrix */}
        {user.sports.length > 0 ? (
          <View style={styles.bodySection}>
            <Text style={styles.sectionHeading}>{tr('userProfile.sports')}</Text>
            <View style={styles.sportsGrid}>
              {user.sports.map((sp) => (
                <View key={sp.sport_id} style={styles.sportCard}>
                  <View style={styles.sportCardTop}>
                    <View style={styles.sportIconWrap}>
                      <Ionicons name="fitness" size={16} color={t.primary} />
                    </View>
                    <Text style={styles.sportCardTitle}>{sportName(sp.sport_id)}</Text>
                  </View>
                  {sp.experience_level ? (
                    <View style={styles.sportBadgeRow}>
                      <View style={styles.levelBadge}>
                        <Text style={styles.levelBadgeText}>
                          {EXPERIENCE_KEYS[sp.experience_level] ? tr(EXPERIENCE_KEYS[sp.experience_level]) : sp.experience_level}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Preferred Routine & Venue */}
        {user.preferred_time || user.favorite_venue ? (
        <View style={styles.bodySection}>
          <Text style={styles.sectionHeading}>{tr('userProfile.routine')}</Text>
          
          {user.preferred_time ? (
          <View style={styles.routineRow}>
            <View style={styles.routineIconWrap}>
              <Ionicons name="time-outline" size={18} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routineTitle}>{tr('userProfile.schedule')}</Text>
              <Text style={styles.routineSub}>{user.preferred_time}</Text>
            </View>
          </View>
          ) : null}

          {user.favorite_venue ? (
          <View style={styles.routineRow}>
            <View style={styles.routineIconWrap}>
              <Ionicons name="navigate-outline" size={18} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routineTitle}>{tr('userProfile.venue')}</Text>
              <Text style={styles.routineSub}>{user.favorite_venue}</Text>
            </View>
          </View>
          ) : null}
        </View>
        ) : null}

        {/* Activity Gallery (4 Photos) */}
        {user.photos.length > 1 && (
          <View style={styles.bodySection}>
            <Text style={styles.sectionHeading}>{tr('userProfile.gallery')}</Text>
            <View style={styles.galleryGrid}>
              {user.photos.slice(1, 5).map((photoUri, idx) => (
                <View key={idx} style={styles.galleryPhotoCard}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Activities this player chose to show on their profile */}
        {profile?.activities.length ? (
          <View style={styles.bodySection}>
            <Text style={styles.sectionHeading}>{tr('activity.sectionTitle')}</Text>
            <ProfileActivities activities={profile.activities} userId={profile.id} style={{ paddingHorizontal: 0 }} />
          </View>
        ) : null}
      </ScrollView>
      )}

      {/* Floating Bottom CTA with Orange Glow */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <LinearGradient
          colors={['transparent', 'rgba(11, 13, 19, 0.95)', t.bg]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <TouchableOpacity
          style={styles.chatActionBtn}
          onPress={() => router.back()}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={tr('userProfile.message')}
        >
          <Ionicons name="chatbubbles" size={19} color={'#FFFFFF'} />
          <Text style={styles.chatActionBtnText}>{tr('userProfile.message')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  stateTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: t.text, textAlign: 'center' },
  stateBtn: { marginTop: 4, paddingHorizontal: 22, height: 46, borderRadius: 999, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' },
  stateBtnText: { fontFamily: fonts.displaySemi, fontSize: 15, color: t.onInk },
  noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceMuted },
  promptCard: { backgroundColor: t.surface, borderRadius: 20, padding: 16, marginBottom: 10, gap: 6 },
  promptQ: { fontFamily: fonts.bodyBold, fontSize: 14, color: t.textSecondary },
  promptA: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 26, color: t.text },
  container: {
    flex: 1,
    backgroundColor: t.bg,
  },
  floatingNav: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 50,
  },
  circleIconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11, 13, 19, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.border,
  },
  heroContainer: {
    width: SCREEN_WIDTH,
    height: HERO_PHOTO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroInfo: {
    position: 'absolute',
    bottom: space.md,
    left: space.md,
    right: space.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroNameText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
  },
  verifiedCheck: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: t.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: t.textSecondary,
  },
  bodySection: {
    paddingHorizontal: space.md,
    marginTop: space.xl,
  },
  sectionHeading: {
    fontFamily: fonts.displaySemi,
    fontSize: 13,
    color: t.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bioBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: t.text,
    lineHeight: 22,
  },
  sportsGrid: {
    gap: 10,
  },
  sportCard: {
    paddingVertical: 12,
  },
  sportCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sportIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportCardTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: t.text,
  },
  sportBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
  },
  levelBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: t.primary,
  },
  sportCardExp: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: t.textSecondary,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  routineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: t.text,
  },
  routineSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: t.textSecondary,
    marginTop: 2,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryPhotoCard: {
    width: (SCREEN_WIDTH - space.md * 2 - 8) / 2, // 2 columns layout
    height: 180,
    borderRadius: 12, // Kotak standard dengan sedikit sudut bulat
    backgroundColor: t.surface,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.md,
    paddingTop: 16,
    zIndex: 40,
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: t.primary,
    height: 52,
    borderRadius: radius.pill,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    elevation: 8,
  },
  chatActionBtnText: {
    fontFamily: fonts.displaySemi,
    color: '#FFFFFF',
    fontSize: 15,
  },
}));
