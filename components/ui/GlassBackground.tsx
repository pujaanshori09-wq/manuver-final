import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { glass } from '@/lib/theme';

/**
 * Black-glass backdrop for the brand screens. Two static gradients only (no blur, no
 * animation), so it costs almost nothing to draw and nothing to keep running.
 */
export const GlassBackground = React.memo(function GlassBackground() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <LinearGradient colors={glass.base} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {/* A diagonal sheen, like light catching a pane of glass. */}
      <LinearGradient
        colors={glass.sheen}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 0.7 }}
        style={styles.sheen}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  sheen: {
    position: 'absolute',
    top: -120,
    left: -90,
    width: '135%',
    height: 520,
    transform: [{ rotate: '-14deg' }],
  },
});
