import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '@/lib/theme';

/** Web version: the browser's own date-and-time input. */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate = new Date(),
}: {
  label: string;
  placeholder: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
}) {
  const s = useStyles();
  const t = useTheme();
  // datetime-local wants local time without a zone: "2026-12-31T07:00".
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <input
        type="datetime-local"
        aria-label={label}
        value={value ? local(value) : ''}
        min={local(minimumDate)}
        onChange={(e) => {
          const d = new Date(e.currentTarget.value);
          if (!Number.isNaN(d.getTime())) onChange(d);
        }}
        style={{
          background: t.surface,
          color: t.text,
          border: `1px solid ${t.border}`,
          borderRadius: radius.md,
          minHeight: 52,
          padding: '0 14px',
          fontFamily: fonts.body,
          fontSize: 15,
          colorScheme: t.scheme,
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    field: { marginBottom: 16 },
    label: { fontFamily: fonts.bodyBold, fontSize: 13, color: t.textSecondary, marginBottom: 8 },
  }),
);
