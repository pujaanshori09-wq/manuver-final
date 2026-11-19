import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/lib/i18n';
import { fonts, makeStyles, radius, useTheme } from '@/lib/theme';

/**
 * Pick a date, then a time (native pickers). Shows the chosen moment in the app language.
 * The web build has its own version (DateTimeField.web.tsx).
 */
export function DateTimeField({
  label,
  placeholder,
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
  const { language } = useLanguage();
  const [step, setStep] = useState<'date' | 'time' | null>(null);
  const current = value ?? new Date(Date.now() + 86_400_000);

  const picked = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === 'dismissed' || !d) {
      setStep(null);
      return;
    }
    onChange(d);
    // Android shows the two pickers one after the other; iOS keeps the spinner open.
    if (Platform.OS === 'android') setStep(step === 'date' ? 'time' : null);
  };

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setStep(step ? null : 'date')}
        style={({ pressed }) => [s.box, pressed && { opacity: 0.8 }]}
      >
        <Ionicons name="calendar-outline" size={18} color={t.textSecondary} />
        <Text style={[s.value, !value && { color: t.textSecondary }]}>
          {value
            ? value.toLocaleString(language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : placeholder}
        </Text>
      </Pressable>
      {step && (
        <View style={Platform.OS === 'ios' ? s.iosRow : undefined}>
          <DateTimePicker
            value={current}
            mode={Platform.OS === 'ios' ? 'datetime' : step}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            themeVariant={t.scheme}
            onChange={picked}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    field: { marginBottom: 16 },
    label: { fontFamily: fonts.bodyBold, fontSize: 13, color: t.textSecondary, marginBottom: 8 },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      minHeight: 52,
    },
    value: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: t.text },
    iosRow: { alignItems: 'center' },
  }),
);
