import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type BurstKind = 'like' | 'pass' | 'super' | 'match';

const PALETTE: Record<BurstKind, { ring: string; streak: string; dot: string }> = {
  like: { ring: '#FF5A1F', streak: '#FF8F52', dot: '#FFFFFF' },
  super: { ring: '#FF8F52', streak: '#FFFFFF', dot: '#FF5A1F' },
  pass: { ring: 'rgba(255,255,255,0.7)', streak: '#FFFFFF', dot: 'rgba(255,255,255,0.8)' },
  match: { ring: '#FF5A1F', streak: '#FF8F52', dot: '#FFFFFF' },
};

/**
 * A short, sporty "splash": a ring that punches outward, speed-slash streaks and a few
 * sparks. Fire-and-forget — remount with a new `key` to replay. Skipped under reduced motion.
 */
export function SplashBurst({
  kind,
  size = 260,
  streaks = 10,
  delay = 0,
  onDone,
}: {
  kind: BurstKind;
  size?: number;
  streaks?: number;
  delay?: number;
  onDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const c = PALETTE[kind];

  useEffect(() => {
    if (reduced) {
      onDone?.();
      return;
    }
    p.value = withDelay(
      delay,
      withTiming(1, { duration: kind === 'match' ? 900 : 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, (done) => {
        if (done && onDone) runOnJS(onDone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ring = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [{ scale: 0.25 + p.value * 1.05 }],
  }));

  if (reduced) return null;

  // Pass = two crossing slashes; everything else = radial speed streaks.
  const angles =
    kind === 'pass'
      ? [-45, 45, 135, -135]
      : kind === 'super'
        ? Array.from({ length: streaks }, (_, i) => -90 + (i - (streaks - 1) / 2) * (110 / streaks))
        : Array.from({ length: streaks }, (_, i) => (360 / streaks) * i + (i % 2 ? 9 : 0));

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, borderColor: c.ring, borderWidth: kind === 'match' ? 6 : 4 },
          ring,
        ]}
      />
      {angles.map((deg, i) => (
        <Streak key={i} p={p} deg={deg} size={size} color={i % 3 === 2 ? c.dot : c.streak} long={i % 2 === 0} />
      ))}
    </View>
  );
}

function Streak({
  p,
  deg,
  size,
  color,
  long,
}: {
  p: SharedValue<number>;
  deg: number;
  size: number;
  color: string;
  long: boolean;
}) {
  const len = size * (long ? 0.26 : 0.18);
  const style = useAnimatedStyle(() => {
    const travel = size * 0.12 + p.value * size * 0.32;
    // Grows quickly, then thins and fades as it flies out.
    const grow = Math.min(1, p.value / 0.35);
    return {
      opacity: p.value < 0.6 ? 1 : 1 - (p.value - 0.6) / 0.4,
      transform: [
        { rotate: `${deg}deg` },
        { translateX: travel },
        { scaleX: 0.2 + grow * 0.8 },
        { scaleY: 1 - p.value * 0.5 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.streak,
        { width: len, marginLeft: -len / 2, backgroundColor: color, height: long ? 6 : 4, borderRadius: 3 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  streak: { position: 'absolute', left: '50%', top: '50%' },
});
