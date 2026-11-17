import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { makeStyles } from '@/lib/theme';
import { GlossFill } from './Gloss';

const W = 56;
const H = 32;
const KNOB = 26;

/** Glossy-orange switch. Off = muted track; on = gloss fill. */
export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const s = useStyles();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [3, W - KNOB - 3] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}
      style={[s.track, disabled && { opacity: 0.5 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, s.clip, { opacity: anim }]}>
        <GlossFill />
      </Animated.View>
      <Animated.View style={[s.knob, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    track: {
      width: W,
      height: H,
      borderRadius: H / 2,
      backgroundColor: t.scheme === 'dark' ? '#3A3A3A' : '#D6D3CF',
      justifyContent: 'center',
    },
    clip: { borderRadius: H / 2, overflow: 'hidden' },
    knob: {
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 2,
    },
  }),
);
