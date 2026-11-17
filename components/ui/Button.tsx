import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { makeStyles, radius, type, useTheme } from '@/lib/theme';
import { GlossFill, glossShadow } from './Gloss';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * primary   → glossy orange (one per screen: the action that moves the user forward)
 * secondary → solid ink (black in light, white in dark)
 * tertiary  → surface with border
 * ghost     → text only
 * danger    → destructive, tinted
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
}: ButtonProps) {
  const t = useTheme();
  const s = useStyles();
  const inactive = disabled || loading;

  const fg =
    inactive && variant !== 'ghost'
      ? t.textDisabled
      : variant === 'primary'
        ? t.onPrimary
        : variant === 'secondary'
          ? t.onInk
          : variant === 'danger'
            ? t.danger
            : t.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        s.base,
        s[size],
        variant === 'primary' && !inactive && glossShadow,
        variant === 'secondary' && s.secondary,
        variant === 'tertiary' && s.tertiary,
        variant === 'danger' && s.danger,
        inactive && variant !== 'ghost' && s.disabled,
        pressed && { transform: [{ scale: 0.98 }], opacity: variant === 'primary' ? 1 : 0.9 },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {variant === 'primary' && !inactive && (
            <View style={[StyleSheet.absoluteFill, s.clip]}>
              <GlossFill />
              {pressed && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.08)' }]} />}
            </View>
          )}
          {loading ? (
            <ActivityIndicator color={variant === 'primary' ? t.onPrimary : t.text} />
          ) : (
            <View style={s.row}>
              {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={fg} />}
              <Text
                numberOfLines={1}
                style={[type.button, size === 'sm' && s.smLabel, { color: fg }]}
              >
                {label}
              </Text>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    clip: { borderRadius: radius.pill, overflow: 'hidden' },
    lg: { minHeight: 58 },
    md: { minHeight: 50 },
    sm: { minHeight: 38, paddingHorizontal: 16 },
    smLabel: { fontSize: 15, lineHeight: 18 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    secondary: { backgroundColor: t.ink },
    tertiary: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
    danger: { backgroundColor: t.dangerSoft },
    disabled: { backgroundColor: t.surfaceMuted, borderWidth: 0 },
  }),
);
