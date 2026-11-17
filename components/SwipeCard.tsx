import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, interpolate, Extrapolation } from 'react-native-reanimated';
import { useT } from '@/lib/i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

export interface SwipeCardRef {
  swipeLeft: () => void;
  swipeRight: () => void;
  swipeUp: () => void;
}

interface SwipeCardProps {
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  onSwipedUp?: () => void;
  /** Fires the moment a swipe is committed (before the card finishes flying away). */
  onSwipeStart?: (direction: 'left' | 'right' | 'up') => void;
  children: React.ReactNode;
}

const SwipeCard = forwardRef<SwipeCardRef, SwipeCardProps>(({ onSwipedLeft, onSwipedRight, onSwipedUp, onSwipeStart, children }, ref) => {
  const tr = useT();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const swipeLeft = () => {
    onSwipeStart?.('left');
    translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: -800, damping: 20, stiffness: 100 }, (isFinished) => {
      if (isFinished) runOnJS(onSwipedLeft)();
    });
  };

  const swipeRight = () => {
    onSwipeStart?.('right');
    translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: 800, damping: 20, stiffness: 100 }, (isFinished) => {
      if (isFinished) runOnJS(onSwipedRight)();
    });
  };

  const swipeUp = () => {
    onSwipeStart?.('up');
    translateY.value = withSpring(-SCREEN_HEIGHT * 1.5, { velocity: -800, damping: 20, stiffness: 100 }, (isFinished) => {
      if (isFinished && onSwipedUp) runOnJS(onSwipedUp)();
    });
  };

  useImperativeHandle(ref, () => ({
    swipeLeft,
    swipeRight,
    swipeUp,
  }));

  // Horizontal pan gesture with vertical scroll allowance
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.15;
    })
    .onEnd((event) => {
      // Allow throwing with high velocity even if threshold not met
      const isThrowLeft = event.translationX < -SWIPE_THRESHOLD || event.velocityX < -800;
      const isThrowRight = event.translationX > SWIPE_THRESHOLD || event.velocityX > 800;

      if (isThrowRight) {
        if (onSwipeStart) runOnJS(onSwipeStart)('right');
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: event.velocityX, damping: 20, stiffness: 100 }, (isFinished) => {
          if (isFinished) runOnJS(onSwipedRight)();
        });
      } else if (isThrowLeft) {
        if (onSwipeStart) runOnJS(onSwipeStart)('left');
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: event.velocityX, damping: 20, stiffness: 100 }, (isFinished) => {
          if (isFinished) runOnJS(onSwipedLeft)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    // Increased rotation angle for a lighter, "paper-like" feel during drag
    const rotate = interpolate(translateX.value, [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2], [-12, 0, 12], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` }
      ]
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
  }));
  
  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP)
  }));

  const superLikeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-20, -SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {children}
        
        {/* Overlays that sit ON TOP of the children */}
        <Animated.View style={[styles.labelContainer, styles.likeLabelContainer, likeOpacity]} pointerEvents="none">
          <Text style={styles.likeLabel}>{tr('discover.stampLike')}</Text>
        </Animated.View>
        <Animated.View style={[styles.labelContainer, styles.nopeLabelContainer, nopeOpacity]} pointerEvents="none">
          <Text style={styles.nopeLabel}>{tr('discover.stampPass')}</Text>
        </Animated.View>
        <Animated.View style={[styles.labelContainer, styles.superLikeLabelContainer, superLikeOpacity]} pointerEvents="none">
          <Text style={styles.superLikeLabel}>{tr('discover.stampSuper')}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

export default SwipeCard;

const stamp = {
  fontFamily: 'Poppins_700Bold',
  fontSize: 30,
  letterSpacing: 1,
} as const;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 22,
    overflow: 'hidden',
  },
  labelContainer: {
    position: 'absolute',
    top: 56,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 4,
    zIndex: 100,
  },
  likeLabelContainer: {
    left: 24,
    borderColor: '#FF5A1F',
    transform: [{ rotate: '-14deg' }],
  },
  nopeLabelContainer: {
    right: 24,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '14deg' }],
  },
  likeLabel: { ...stamp, color: '#FF5A1F' },
  nopeLabel: { ...stamp, color: '#FFFFFF' },
  superLikeLabelContainer: {
    top: 'auto',
    bottom: 140,
    alignSelf: 'center',
    borderColor: '#FF8F52',
    transform: [{ rotate: '-8deg' }],
  },
  superLikeLabel: { ...stamp, color: '#FF8F52' },
});
