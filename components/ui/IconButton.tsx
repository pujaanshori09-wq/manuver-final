import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '@/lib/theme';

type Variant = 'surface' | 'plain' | 'ink';

/** Circular icon button (back, settings, close). 44pt minimum target. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'surface',
  size = 44,
  iconSize = 22,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const s = useStyles();
  const color = variant === 'ink' ? t.onInk : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        s.base,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'surface' && s.surface,
        variant === 'ink' && { backgroundColor: t.ink },
        pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    base: { alignItems: 'center', justifyContent: 'center' },
    surface: {
      backgroundColor: t.surface,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.scheme === 'dark' ? 0.4 : 0.1,
      shadowRadius: 10,
      elevation: 3,
    },
  }),
);
