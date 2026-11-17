import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { makeStyles, radius, type, useTheme } from '@/lib/theme';
import { GlossFill } from './Gloss';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
};

export function Chip({ label, selected, onPress, icon, disabled }: ChipProps) {
  const t = useTheme();
  const s = useStyles();
  const fg = selected ? t.onPrimary : disabled ? t.textDisabled : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [s.chip, pressed && !selected && s.pressed, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      {selected && (
        <View style={[StyleSheet.absoluteFill, s.clip]}>
          <GlossFill />
        </View>
      )}
      {icon && <Ionicons name={icon} size={16} color={fg} />}
      <Text style={[type.callout, s.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Wrapping group of chips with an optional "Show more" collapse, like the reference. */
export function ChipGroup<T extends string>({
  options,
  isSelected,
  onToggle,
  collapsedCount,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  isSelected: (v: T) => boolean;
  onToggle: (v: T) => void;
  collapsedCount?: number;
}) {
  const s = useStyles();
  const tr = useT();
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const canCollapse = collapsedCount != null && options.length > collapsedCount;
  // Selected chips always stay visible even when collapsed.
  const visible =
    canCollapse && !expanded
      ? options.filter((o, i) => i < collapsedCount! || isSelected(o.value))
      : options;

  return (
    <View>
      <View style={s.wrap}>
        {visible.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            icon={o.icon}
            selected={isSelected(o.value)}
            onPress={() => onToggle(o.value)}
          />
        ))}
      </View>
      {canCollapse && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((e) => !e)}
          style={s.moreRow}
          hitSlop={8}
        >
          <View style={s.moreLine} />
          <Text style={[type.label, { color: t.text }]}>{expanded ? tr('common.showLess') : tr('common.showMore')}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={t.text} />
          <View style={s.moreLine} />
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
      backgroundColor: t.surfaceMuted,
    },
    clip: { borderRadius: radius.pill, overflow: 'hidden' },
    pressed: { backgroundColor: t.surfacePressed },
    label: { fontFamily: 'Lato_700Bold' },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    moreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
    moreLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.border },
  }),
);
