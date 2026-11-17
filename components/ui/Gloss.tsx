import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * The signature glossy-orange fill: a vertical lit-to-burnt gradient plus a soft
 * specular band across the top half. Absolutely fills its parent; the parent owns
 * the radius (use overflow: 'hidden').
 */
export function GlossFill({ style, highlight = true }: { style?: StyleProp<ViewStyle>; highlight?: boolean }) {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={t.gloss as unknown as [string, string, string]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {highlight && (
        <LinearGradient
          colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          locations={[0, 0.6, 1]}
          style={styles.highlight}
        />
      )}
    </View>
  );
}

/** Offset, soft, orange-tinted drop shadow for glossy elements. */
export const glossShadow: ViewStyle = {
  shadowColor: '#C2410C',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.32,
  shadowRadius: 12,
  elevation: 6,
};

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '52%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
});
