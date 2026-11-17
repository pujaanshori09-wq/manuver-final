import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, type TextInputInstance } from 'react-native';
import { makeStyles, type, useTheme } from '@/lib/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  prefix?: React.ReactNode;
  secureToggle?: boolean;
};

/** Large underline field, as in the reference phone-number screen. Focus = orange underline. */
export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, error, prefix, secureToggle, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const t = useTheme();
  const s = useStyles();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const lineColor = error ? t.danger : focused ? t.primary : t.border;

  return (
    <View style={s.wrap}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={[s.row, { borderBottomColor: lineColor }]}>
        {prefix}
        <TextInput
          ref={ref}
          placeholderTextColor={t.textMuted}
          selectionColor={t.primary}
          cursorColor={t.primary}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[s.input, style]}
          {...rest}
        />
        {secureToggle && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={t.textSecondary} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { ...type.label, color: t.textSecondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 2,
      paddingBottom: 8,
    },
    input: {
      flex: 1,
      // Lets the field shrink next to a prefix on narrow phones (web inputs have an intrinsic width).
      minWidth: 0,
      fontFamily: 'Lato_700Bold',
      fontSize: 20,
      paddingVertical: 6,
      color: t.text,
      // Web only: the orange underline is the focus indicator.
      outlineWidth: 0,
    } as any,
    error: { ...type.caption, color: t.danger },
  }),
);
