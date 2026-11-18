import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, GlossFill, glossShadow, IconButton, SplashBurst, useTabBarInset, type BurstKind } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fonts, makeStyles, space, ThemeScope, type, useTheme } from '@/lib/theme';
import LocationPermissionModal from '../../components/LocationPermissionModal';
import MatchCelebration from '../../components/MatchCelebration';
import ProfileBottomSheet from '../../components/ProfileBottomSheet';
import ProfileCardSummary from '../../components/ProfileCardSummary';
import RadarAnimation from '../../components/RadarAnimation';
import SwipeCard, { SwipeCardRef } from '../../components/SwipeCard';
import { useLocationManager } from '../../hooks/useLocationManager';
import { useProfiles } from '../../hooks/useProfiles';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types/database';

const DEMO_PROFILES: Profile[] = [
  {
    id: 'demo-1',
    nama: 'Pengguna Baru',
    umur: 24,
    foto_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80&crop=bottom',
    ],
    alamat: 'GBK Senayan',
    jarak: '2 km away',
    hobi: 'Gym & Fitness, Running, Badminton',
    prompt_question: 'Target olahraga bulan ini',
    prompt_answer: 'Rutinitas lari 5K sub-28 menit & konsisten gym 3x seminggu. Butuh partner yang gak gampang cancel!',
    bio: 'Senang olahraga bareng. Mencari partner latihan rutin di sekitarku dan ikut event lari bersama.',
    skill_level: 'Intermediate',
    availability: ['Pagi', 'Sore', 'Akhir Pekan'],
    distance_pref: '≤ 10 km',
    interests: ['Health', 'Travel', 'Music', 'Food'],
  },
  {
    id: 'demo-2',
    nama: 'Dinda',
    umur: 25,
    foto_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=80',
    ],
    alamat: 'Senayan',
    jarak: '3 km away',
    hobi: 'Badminton, Running, Yoga',
    prompt_question: 'Partner sparing ideal buatku',
    prompt_answer: 'Yang mainnya seru, bisa rally panjang badminton, dan setelahnya ngopi bareng santai.',
    bio: 'Cari partner badminton santai atau sparring lari pagi di GBK. Let’s stay active together! 💪🏸',
    skill_level: 'Advanced',
    availability: ['Pagi', 'Akhir Pekan'],
    distance_pref: '≤ 5 km',
    interests: ['Health', 'Outdoor', 'Coffee'],
  },
  {
    id: 'demo-3',
    nama: 'Reza',
    umur: 27,
    foto_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1000&q=80',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=1000&q=80',
    ],
    alamat: 'Cilandak',
    jarak: '4 km away',
    hobi: 'Gym & Fitness, Basketball, Running',
    prompt_question: 'Gaya latihan favorit',
    prompt_answer: 'Push-Pull-Legs di gym, lanjut pickup game basket Sabtu sore. Disiplin tapi tetap enjoy!',
    bio: 'Gym 4x seminggu & main basket santai akhir pekan. Looking for a disciplined gym bro.',
    skill_level: 'Intermediate',
    availability: ['Malam', 'Akhir Pekan'],
    distance_pref: '≤ 15 km',
  }
];

export default function DiscoverScreen() {
  // Discover is always dark, whatever the system setting.
  return (
    <ThemeScope scheme="dark">
      <StatusBar style="light" />
      <Discover />
    </ThemeScope>
  );
}

function Discover() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const tabInset = useTabBarInset();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const swipeCardRef = useRef<SwipeCardRef>(null);
  const [deckHeight, setDeckHeight] = useState(0);
  // Splash played over the deck the moment a swipe is committed.
  const [burst, setBurst] = useState<{ kind: BurstKind; id: number } | null>(null);
  const onSwipeStart = useCallback((dir: 'left' | 'right' | 'up') => {
    setBurst({ kind: dir === 'left' ? 'pass' : dir === 'up' ? 'super' : 'like', id: Date.now() });
  }, []);

  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    matchData,
    myAvatarUrl,
    fetchProfiles,
    handleSwipeComplete,
    closeMatchModal,
  } = useProfiles();

  // Location Manager
  const [modalVisible, setModalVisible] = useState(false);
  const { permissionState, loading: locationLoading, requestPermissions, openSettings, getCurrentLocation } = useLocationManager();

  // Show contextual permission modal if never asked
  useEffect(() => {
    if (!locationLoading && permissionState === 'NOT_DETERMINED') {
      setModalVisible(true);
    }
  }, [locationLoading, permissionState]);

  const handleRequestLocation = async () => {
    const newState = await requestPermissions();
    if (newState === 'GRANTED') {
      setModalVisible(false);
      const loc = await getCurrentLocation();
      if (loc) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          await supabase.from('profiles').update({
            last_latitude: loc.coords.latitude,
            last_longitude: loc.coords.longitude,
          }).eq('id', userData.user.id);
        }
      }
      fetchProfiles();
    }
  };

  const loading = profilesLoading || locationLoading;

  useFocusEffect(
    useCallback(() => {
      fetchProfiles();
    }, [fetchProfiles])
  );

  const currentProfile = profiles[0];
  const nextProfile = profiles[1];

  const resetScrollPosition = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const onSwipeComplete = async (direction: 'left' | 'right' | 'up') => {
    if (currentProfile) {
      await handleSwipeComplete(currentProfile, direction);
    }
    resetScrollPosition();
  };

  const triggerSwipe = (direction: 'left' | 'right' | 'up') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (direction === 'left') {
      swipeCardRef.current?.swipeLeft();
    } else if (direction === 'right') {
      swipeCardRef.current?.swipeRight();
    } else if (direction === 'up') {
      swipeCardRef.current?.swipeUp();
    }
  };

  // Action buttons (with their labels underneath) float over the bottom of the card, just above the tab bar.
  const actionsBottom = tabInset + 2;
  const ACTION_SIZE = 66;

  return (
    <>
      <GestureHandlerRootView style={s.root}>
        <View style={[s.container, { paddingTop: insets.top }]}>
          <View style={s.header}>
            <View style={s.headerSide} />
            <Text style={s.wordmark} numberOfLines={1} allowFontScaling={false} accessibilityRole="header">
              manuver
            </Text>
            <IconButton
              icon="options-outline"
              onPress={() => router.push('/settings/filters')}
              accessibilityLabel={tr('discover.filters')}
            />
          </View>

          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={t.primary} />
            </View>
          ) : profilesError && !currentProfile ? (
            <View style={[s.empty, { paddingBottom: tabInset }]}>
              <Ionicons name="cloud-offline-outline" size={48} color={t.textMuted} />
              <Text style={s.emptyTitle} accessibilityRole="header">
                {tr('discover.loadFailedTitle')}
              </Text>
              <Text style={s.emptyBody}>{tr('discover.loadFailedBody')}</Text>
              <View style={s.emptyActions}>
                <Button label={tr('common.retry')} onPress={() => fetchProfiles()} />
              </View>
            </View>
          ) : !currentProfile ? (
            <View style={[s.empty, { paddingBottom: tabInset }]}>
              <RadarAnimation />
              <Text style={s.emptyTitle} accessibilityRole="header">
                {tr('discover.emptyTitle')}
              </Text>
              <Text style={s.emptyBody}>{tr('discover.emptyBody')}</Text>
              <View style={s.emptyActions}>
                <Button label={tr('discover.emptyCta')} onPress={() => router.push('/settings/filters')} />
                <Button label={tr('discover.refresh')} variant="ghost" onPress={() => fetchProfiles()} />
              </View>
            </View>
          ) : (
            <View
              style={[s.deck, { marginBottom: tabInset - ACTION_SIZE / 2 - 8 }]}
              onLayout={(e) => setDeckHeight(e.nativeEvent.layout.height)}
            >
              {nextProfile && (nextProfile.photos?.[0] || nextProfile.foto_url) && (
                <View style={[s.card, s.nextCard]}>
                  <Image
                    source={{ uri: nextProfile.photos?.[0] || nextProfile.foto_url }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                </View>
              )}

              <SwipeCard
                key={currentProfile.id}
                ref={swipeCardRef}
                onSwipedLeft={() => onSwipeComplete('left')}
                onSwipedRight={() => onSwipeComplete('right')}
                onSwipedUp={() => onSwipeComplete('up')}
                onSwipeStart={onSwipeStart}
              >
                <View style={s.card}>
                  <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: ACTION_SIZE + 24 }}
                    showsVerticalScrollIndicator={false}
                    bounces
                  >
                    {deckHeight > 0 && (
                      <ProfileCardSummary
                        profile={currentProfile}
                        heroHeight={deckHeight}
                        heroBottomInset={ACTION_SIZE + 84}
                        onExpandPress={() => setDetailSheetVisible(true)}
                      />
                    )}
                  </ScrollView>
                </View>
              </SwipeCard>

              {burst && (
                <View pointerEvents="none" style={s.burstLayer}>
                  <SplashBurst key={burst.id} kind={burst.kind} size={280} onDone={() => setBurst(null)} />
                </View>
              )}
            </View>
          )}

          {!loading && currentProfile && (
            <View pointerEvents="box-none" style={[s.actions, { bottom: actionsBottom }]}>
              <ActionButton label={tr('discover.skipShort')} a11y={tr('discover.pass')} onPress={() => triggerSwipe('left')} style={s.skipBtn}>
                <Ionicons name="close" size={30} color="#FFFFFF" />
              </ActionButton>

              <ActionButton label={tr('discover.boostShort')} a11y={tr('discover.super')} onPress={() => triggerSwipe('up')} style={s.boostBtn}>
                <Ionicons name="flash" size={22} color={t.primary} />
              </ActionButton>

              <ActionButton
                label={tr('discover.inviteShort')}
                a11y={tr('discover.like')}
                onPress={() => triggerSwipe('right')}
                style={s.inviteBtn}
                primary
              >
                <View style={s.inviteClip}>
                  <GlossFill />
                </View>
                <MaterialCommunityIcons name="handshake-outline" size={34} color="#FFFFFF" />
              </ActionButton>
            </View>
          )}
        </View>
      </GestureHandlerRootView>

      <LocationPermissionModal
        visible={modalVisible}
        state={permissionState}
        loading={locationLoading}
        onRequestPermission={handleRequestLocation}
        onOpenSettings={openSettings}
        onSkip={() => setModalVisible(false)}
      />

      <MatchCelebration
        visible={matchData !== null}
        matchData={matchData}
        myAvatarUrl={myAvatarUrl}
        onClose={closeMatchModal}
      />

      <ProfileBottomSheet
        visible={detailSheetVisible}
        profile={currentProfile}
        onClose={() => setDetailSheetVisible(false)}
        onSwipeAction={(action) => {
          setDetailSheetVisible(false);
          triggerSwipe(action);
        }}
      />
    </>
  );
}

/** A round Discover action with its name underneath, so every button says what it does. */
function ActionButton({
  label,
  a11y,
  onPress,
  style,
  primary,
  children,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  style: object;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const s = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={s.actionCol}>
      {({ pressed }) => (
        <>
          <View style={s.actionSlot}>
            <View style={[style, pressed && s.pressed]}>{children}</View>
          </View>
          <Text style={[s.actionLabel, primary && s.actionLabelPrimary]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.md,
      height: 56,
    },
    // Fixed width: iOS can measure the wordmark before Poppins is applied and clip it ("manuv").
    wordmark: { fontFamily: fonts.display, fontSize: 27, lineHeight: 34, letterSpacing: -0.5, color: t.primary, flex: 1, textAlign: 'center' },
    headerSide: { width: 44 },
    burstLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 40 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    deck: { flex: 1, marginHorizontal: space.xs },
    card: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: t.surface,
    },
    nextCard: { transform: [{ scale: 0.95 }, { translateY: 10 }], opacity: 0.45 },
    actions: {
      position: 'absolute',
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      zIndex: 30,
    },
    actionCol: { width: 96, alignItems: 'center' },
    actionSlot: { height: 72, alignItems: 'center', justifyContent: 'center' },
    actionLabel: {
      marginTop: 6,
      maxWidth: 96,
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      lineHeight: 16,
      color: 'rgba(255,255,255,0.86)',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    actionLabelPrimary: { fontFamily: fonts.bodyBlack, color: '#FFFFFF' },
    skipBtn: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(12,12,12,0.6)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.55)',
    },
    boostBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(28,28,28,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    inviteBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      ...glossShadow,
    },
    inviteClip: { ...StyleSheet.absoluteFill, borderRadius: 36, overflow: 'hidden' },
    pressed: { transform: [{ scale: 0.94 }] },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
    emptyTitle: { ...type.title, color: t.text, textAlign: 'center', marginTop: -space.xl },
    emptyBody: { ...type.body, color: t.textSecondary, textAlign: 'center', marginTop: space.xs },
    emptyActions: { alignSelf: 'stretch', gap: space.xs, marginTop: space.xl },
  }),
);
