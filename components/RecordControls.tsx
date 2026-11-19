import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fonts, useTheme } from '@/lib/theme';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

type Icon = keyof typeof Ionicons.glyphMap;

/**
 * The big round record button. `tone` "primary" is glossy orange, "ink" is black/white.
 * `pulse` draws a soft ring breathing out from it while recording.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  tone = 'primary',
  size = 84,
  pulse = false,
  disabled = false,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ink';
  size?: number;
  pulse?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse || reduce) return;
    const loop = Animated.loop(
      Animated.timing(wave, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      wave.setValue(0);
    };
  }, [pulse, reduce, wave]);

  const fg = tone === 'primary' ? t.onPrimary : t.onInk;
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {pulse && !reduce && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: size / 2,
                backgroundColor: t.primary,
                opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
              },
            ]}
          />
        )}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', opacity: disabled ? 0.45 : 1 },
            s.shadow,
            { shadowColor: tone === 'primary' ? t.primary : t.shadow },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
        >
          {tone === 'primary' ? (
            <LinearGradient colors={t.gloss} style={s.fill}>
              <Ionicons name={icon} size={size * 0.4} color={fg} />
            </LinearGradient>
          ) : (
            <View style={[s.fill, { backgroundColor: t.ink }]}>
              <Ionicons name={icon} size={size * 0.4} color={fg} />
            </View>
          )}
        </Pressable>
      </View>
      <Text style={[s.label, { color: t.text }]}>{label}</Text>
    </View>
  );
}

/**
 * Press and hold for a second to finish, so a pocket tap cannot end the activity.
 * A ring fills while held; letting go early winds it back. Screen readers activate it directly.
 */
export function HoldButton({ label, hint, onDone, size = 84 }: { label: string; hint: string; onDone: () => void; size?: number }) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  // Plain state drives the ring: an animated SVG prop leaks React Native attributes into the DOM on web.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => setFill(value));
    return () => progress.removeListener(id);
  }, [progress]);
  const stroke = 5;
  const r = (size + 12 - stroke) / 2;
  const c = 2 * Math.PI * r;

  const pressIn = () => {
    Haptics.selectionAsync().catch(() => {});
    anim.current = Animated.timing(progress, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (!finished) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      progress.setValue(0);
      onDone();
    });
  };
  const pressOut = () => {
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: size + 12, height: size + 12, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size + 12} height={size + 12} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Circle cx={(size + 12) / 2} cy={(size + 12) / 2} r={r} stroke={t.hairline} strokeWidth={stroke} fill="none" />
          <Circle
            cx={(size + 12) / 2}
            cy={(size + 12) / 2}
            r={r}
            stroke={t.primary}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - fill)}
            transform={`rotate(-90 ${(size + 12) / 2} ${(size + 12) / 2})`}
          />
        </Svg>
        <Pressable
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onDone()}
          style={({ pressed }) => [
            s.center,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: t.ink },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons name="stop" size={size * 0.36} color={t.onInk} />
        </Pressable>
      </View>
      <Text style={[s.label, { color: t.text }]}>{label}</Text>
      <Text style={[s.hint, { color: t.textSecondary }]}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  shadow: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, marginTop: -6 },
});
