import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { makeStyles, radius, type, useTheme } from '@/lib/theme';
import { Toggle } from './Toggle';

/** Grouped list section with heading and footnote, like iOS grouped settings. */
export function ListSection({
  title,
  footer,
  children,
  badge,
}: {
  title?: string;
  footer?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const s = useStyles();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={s.section}>
      {title && (
        <View style={s.titleRow}>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          {badge}
        </View>
      )}
      <View style={s.group}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={s.divider} />}
            {child}
          </View>
        ))}
      </View>
      {footer && <Text style={s.footer}>{footer}</Text>}
    </View>
  );
}

type RowProps = {
  label: string;
  description?: string;
  value?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  chevron?: boolean;
  checked?: boolean;
  toggle?: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean };
  destructive?: boolean;
  centered?: boolean;
  right?: React.ReactNode;
};

export function ListRow({
  label,
  description,
  value,
  icon,
  onPress,
  chevron = !!onPress,
  checked,
  toggle,
  destructive,
  centered,
  right,
}: RowProps) {
  const t = useTheme();
  const s = useStyles();
  const color = destructive ? t.danger : t.text;

  const content = (
    <View style={[s.row, centered && { justifyContent: 'center' }]}>
      {icon && <Ionicons name={icon} size={20} color={t.textSecondary} style={s.icon} />}
      <View style={[s.texts, centered && { flex: 0, alignItems: 'center' }]}>
        <Text style={[type.body, { color }]}>{label}</Text>
        {description && <Text style={s.description}>{description}</Text>}
      </View>
      {value != null && (
        <Text style={s.value} numberOfLines={2}>
          {value}
        </Text>
      )}
      {right}
      {toggle && <Toggle {...toggle} accessibilityLabel={label} />}
      {checked && <Ionicons name="checkmark" size={22} color={t.primaryText} />}
      {chevron && !toggle && <Ionicons name="chevron-forward" size={20} color={t.textSecondary} />}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={checked != null ? { selected: !!checked } : undefined}
      onPress={onPress}
      style={({ pressed }) => pressed && { backgroundColor: t.surfacePressed }}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    section: { marginTop: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, paddingHorizontal: 4 },
    title: { ...type.subheading, color: t.text },
    group: {
      backgroundColor: t.surface,
      borderRadius: radius.card + 6,
      overflow: 'hidden',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    icon: { marginRight: 2 },
    texts: { flex: 1, gap: 2 },
    description: { ...type.caption, color: t.textSecondary },
    value: { ...type.callout, color: t.textSecondary, textAlign: 'right', maxWidth: '45%' },
    footer: { ...type.caption, color: t.textSecondary, marginTop: 8, paddingHorizontal: 4 },
  }),
);
