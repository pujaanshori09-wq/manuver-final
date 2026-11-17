import React, { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const LOGO = require('../../assets/images/logo.png');

type Props = {
  size?: number;
  /** Logo color. Default: brand orange. */
  tint?: string;
  /** Fade/rise/scale in on mount. Turn off when the previous screen already showed the logo. */
  entering?: boolean;
  /** Slow breathing loop after the entrance. */
  idle?: boolean;
  delay?: number;
};

/**
 * The Manuver mark with a smooth entrance and a barely-there idle "breath".
 * Everything runs on the UI thread (opacity/transform only), and both motions stop for
 * users who asked the OS to reduce motion.
 */
export function BrandMark({ size = 260, tint = '#FF5A1F', entering = true, idle = true, delay = 0 }: Props) {
  const reduced = useReducedMotion();
  const enter = useSharedValue(reduced || !entering ? 1 : 0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    if (entering) {
      enter.value = withDelay(delay, withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }));
    }
    if (idle) {
      breath.value = withDelay(
        delay + (entering ? 850 : 0),
        withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true),
      );
    }
    return () => {
      cancelAnimation(enter);
      cancelAnimation(breath);
    };
    // Mount-only: the animation is a one-off, props are not expected to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 16 },
      { scale: (0.86 + 0.14 * enter.value) * (1 + breath.value * 0.025) },
    ],
  }));

  return (
    <Animated.Image
      source={LOGO}
      resizeMode="contain"
      accessibilityLabel="Manuver"
      style={[{ width: size, height: size, tintColor: tint }, style]}
    />
  );
}

/** Room the top bar takes under the status bar (padding + 44pt controls + breathing room). */
const TOP_BAR = 64;
/** Estimated tagline line + gap, used to centre logo and tagline as one group. */
const TAGLINE_H = 34;
/** Fallback height of the bottom action block (Welcome's), until the screen measures its own. */
const DEFAULT_ACTIONS = 210;

/**
 * The logo (plus an optional tagline) centred in the free space between the top bar and the
 * action block at the bottom, a touch above the true middle (optical centre). The size follows
 * the screen, from small Androids to tall iPhones. Screens pass `bottom` (the y where their
 * actions start, from onLayout); when it changes the logo glides to its new spot instead of
 * jumping, so cross-fades between Welcome, sign-in and loading stay calm.
 */
export function BrandStage({
  entering = true,
  bottom,
  children,
}: {
  entering?: boolean;
  /** Screen y where the bottom action block starts. */
  bottom?: number;
  /** Placed directly under the visible mark (e.g. a tagline). */
  children?: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const regionTop = insets.top + TOP_BAR;
  const regionBottom = (bottom ?? height - insets.bottom - DEFAULT_ACTIONS) - 16;
  const region = Math.max(160, regionBottom - regionTop);

  // The PNG has generous empty margins: the visible mark spans ~31%-67% of its height.
  const tagline = children ? TAGLINE_H : 0;
  const size = Math.round(Math.max(140, Math.min(width * 0.6, (region - tagline) / 0.36 * 0.55, 270)));
  const group = size * 0.36 + tagline;
  const visibleTop = regionTop + Math.max(0, (region - group) * 0.46);
  const target = visibleTop - size * 0.31;

  const top = useSharedValue(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      top.value = target;
      return;
    }
    top.value = withTiming(target, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [target, top]);
  const style = useAnimatedStyle(() => ({ top: top.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.stage, style]}>
      <BrandMark size={size} entering={entering} />
      {children ? <View style={{ marginTop: -size * 0.33 + 8 }}>{children}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
