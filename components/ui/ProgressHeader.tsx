import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { makeStyles, type, useTheme } from '@/lib/theme';
import { GlossFill } from './Gloss';
import { IconButton } from './IconButton';

/** Onboarding header: back · glossy progress track · Skip. */
export function ProgressHeader({
  progress,
  onBack,
  onSkip,
}: {
  progress: number; // 0..1
  onBack?: () => void;
  onSkip?: () => void;
}) {
  const t = useTheme();
  const s = useStyles();
  const tr = useT();
  const anim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 420,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [progress, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.row}>
      <View style={s.side}>
        {onBack && (
          <IconButton icon="chevron-back" variant="plain" iconSize={28} onPress={onBack} accessibilityLabel={tr('common.back')} />
        )}
      </View>
      <View
        style={s.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <Animated.View style={[s.fill, { width }]}>
          <GlossFill highlight={false} />
        </Animated.View>
      </View>
      <View style={[s.side, { alignItems: 'flex-end' }]}>
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={12} accessibilityRole="button">
            <Text style={[type.subheading, { color: t.text }]}>{tr('common.skip')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 12 },
    side: { width: 72, justifyContent: 'center' },
    track: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.surfaceMuted,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  }),
);
