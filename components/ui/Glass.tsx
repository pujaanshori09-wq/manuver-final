import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * Frosted surface for floating chrome only (tab bar, sheet headers).
 * iOS gets a real blur; Android gets a near-opaque fallback (blur there is costly/unreliable).
 */
export function Glass({
  style,
  children,
  intensity = 60,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  intensity?: number;
}) {
  const t = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <View style={[{ overflow: 'hidden' }, style]}>
        <BlurView
          tint={t.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
          intensity={intensity}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }
  return <View style={[{ backgroundColor: t.glassFallback, overflow: 'hidden' }, style]}>{children}</View>;
}
