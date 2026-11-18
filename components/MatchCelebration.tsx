import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Button, GlossFill, glossShadow, SplashBurst } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fonts, makeStyles, space, ThemeScope, type, useTheme, type Theme } from '@/lib/theme';

type MatchData = {
  partnerId?: string;
  nama: string;
  foto_url: string | null;
  matchId: string;
};

type Props = {
  visible: boolean;
  matchData: MatchData | null;
  myAvatarUrl: string | null;
  onClose: () => void;
};

const AVATAR = 132;

/**
 * Match moment: the two players slide in and collide, the spark pops, and a glossy splash
 * bursts behind them. Always dark. Reduced motion shows the final state without movement.
 */
export default function MatchCelebration(props: Props) {
  if (!props.matchData) return null;
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <ThemeScope scheme="dark">
        <Celebration {...props} matchData={props.matchData} />
      </ThemeScope>
    </Modal>
  );
}

function Celebration({ visible, matchData, myAvatarUrl, onClose }: Props & { matchData: MatchData }) {
  const tr = useT();
  const t = useTheme();
  const s = useStyles();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [burstKey, setBurstKey] = useState(0);

  const slide = useSharedValue(reduced ? 1 : 0);
  const spark = useSharedValue(reduced ? 1 : 0);
  const content = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reduced) return;
    slide.value = 0;
    spark.value = 0;
    content.value = 0;
    slide.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) });
    spark.value = withDelay(360, withSequence(withSpring(1.25, { damping: 6, stiffness: 220 }), withSpring(1)));
    content.value = withDelay(520, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    setBurstKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Dismiss on its own after 3 s; the chat stays reachable from the Chat tab.
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onClose, 3000);
    return () => clearTimeout(id);
    // Only `visible` restarts the timer; onClose is a fresh function on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - slide.value) * -160 }, { rotate: `${-8 * slide.value}deg` }],
    opacity: slide.value,
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - slide.value) * 160 }, { rotate: `${8 * slide.value}deg` }],
    opacity: slide.value,
  }));
  const sparkStyle = useAnimatedStyle(() => ({ transform: [{ scale: spark.value }], opacity: Math.min(1, spark.value) }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 24 }],
  }));

  const handleSendMessage = () => {
    onClose();
    router.push({
      pathname: '/chat/[id]',
      params: { id: matchData.matchId, name: matchData.nama, avatar: matchData.foto_url ?? '', partnerId: matchData.partnerId ?? '' },
    });
  };

  return (
    <View style={s.overlay}>
      <View style={s.stage}>
        {/* Burst sits behind the avatars, timed to the collision */}
        <View pointerEvents="none" style={s.burst}>
          {burstKey > 0 && <SplashBurst key={burstKey} kind="match" size={340} streaks={14} delay={360} />}
        </View>

        <View style={s.pair}>
          <Animated.View style={[s.avatarFrame, leftStyle]}>
            {renderAvatar(myAvatarUrl)}
          </Animated.View>
          <Animated.View style={[s.avatarFrame, s.right, rightStyle]}>
            {renderAvatar(matchData.foto_url)}
          </Animated.View>
          <Animated.View style={[s.spark, sparkStyle]}>
            <GlossFill />
            <Ionicons name="flash" size={28} color="#FFFFFF" />
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[s.content, contentStyle]}>
        <Text style={s.title} accessibilityRole="header">
          {tr('sheets.itsAMatch')}
        </Text>
        <Text style={s.subtitle}>
          {tr('matchCelebration.bodyA')}
          <Text style={s.highlight}>{matchData.nama}</Text>
          {' · '}
          {tr('sheets.bothPlay')}
        </Text>

        <View style={s.buttons}>
          <Button label={tr('sheets.sendMessage')} icon="chatbubble-ellipses-outline" onPress={handleSendMessage} />
          <Button label={tr('sheets.keepDiscovering')} variant="ghost" onPress={onClose} />
        </View>
      </Animated.View>
    </View>
  );

  function renderAvatar(uri: string | null) {
    return uri ? (
      <Image source={{ uri }} style={s.avatar} />
    ) : (
      <View style={[s.avatar, s.placeholder]}>
        <Ionicons name="person" size={44} color={t.textSecondary} />
      </View>
    );
  }
}

const useStyles = makeStyles((t: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(10,10,10,0.96)',
      justifyContent: 'center',
      paddingHorizontal: space.xl,
    },
    stage: { height: 300, alignItems: 'center', justifyContent: 'center' },
    burst: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    pair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    avatarFrame: {
      width: AVATAR + 8,
      height: AVATAR * 1.3 + 8,
      borderRadius: 28,
      padding: 4,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 10,
    },
    right: { marginLeft: -26 },
    avatar: { width: '100%', height: '100%', borderRadius: 24, backgroundColor: t.surfaceMuted },
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    spark: {
      position: 'absolute',
      bottom: -20,
      width: 60,
      height: 60,
      borderRadius: 30,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: '#0A0A0A',
      ...glossShadow,
    },
    content: { alignItems: 'center', marginTop: space.xxl },
    title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1, color: t.text, textAlign: 'center' },
    subtitle: { ...type.body, color: t.textSecondary, textAlign: 'center', marginTop: space.xs },
    highlight: { fontFamily: fonts.bodyBold, color: t.primaryText },
    buttons: { alignSelf: 'stretch', gap: space.xs, marginTop: space.xxl },
  }),
);
