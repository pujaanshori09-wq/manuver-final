import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { glass, radius, type } from '@/lib/theme';

/** Translucent pill for black-glass screens (secondary actions, sign-in methods). */
export function GlassButton({
  label,
  onPress,
  icon,
  loading,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading, disabled: !!loading }}
      disabled={loading}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.pill,
        icon && styles.withIcon,
        pressed && { backgroundColor: glass.fillPressed, transform: [{ scale: 0.985 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={22} color="#FFFFFF" style={styles.icon} />}
          <Text numberOfLines={2} style={styles.label}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    // A brighter top edge reads as light on the rim of the glass.
    borderTopColor: glass.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Room for the icon on the left, balanced on the right so long labels still fit.
  withIcon: { paddingLeft: 52, paddingRight: 16 },
  icon: { position: 'absolute', left: 22 },
  label: { ...type.button, fontSize: 15, lineHeight: 19, color: '#FFFFFF', textAlign: 'center', flexShrink: 1 },
});
