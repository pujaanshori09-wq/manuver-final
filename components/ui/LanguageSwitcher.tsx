import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Language, useLanguage } from '@/lib/i18n';
import { glass, makeStyles, radius, useTheme } from '@/lib/theme';

const OPTIONS = ['en', 'id'] as const satisfies readonly Language[];

/** Compact "EN | ID" segmented pill for welcome/login. `onDark` = translucent glass for the black brand screens. */
export function LanguageSwitcher({ onDark, style }: { onDark?: boolean; style?: StyleProp<ViewStyle> }) {
  const { language, setLanguage, t: tr } = useLanguage();
  const t = useTheme();
  const s = useStyles();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={tr('language.title')}
      style={[s.pill, onDark && s.pillOnDark, style]}
    >
      {OPTIONS.map((l) => {
        const active = l === language;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tr(`language.${l}`)}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              setLanguage(l);
            }}
            hitSlop={6}
            style={[s.seg, active && (onDark ? s.segActiveOnDark : { backgroundColor: t.ink })]}
          >
            <Text
              style={[
                s.label,
                { color: active ? (onDark ? '#111111' : t.onInk) : onDark ? 'rgba(255,255,255,0.85)' : t.textSecondary },
              ]}
            >
              {l.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: radius.pill,
      backgroundColor: t.surfaceMuted,
      alignSelf: 'flex-start',
    },
    pillOnDark: {
      backgroundColor: glass.fill,
      borderWidth: 1,
      borderColor: glass.border,
      borderTopColor: glass.highlight,
    },
    seg: { minWidth: 44, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
    segActiveOnDark: { backgroundColor: '#FFFFFF' },
    label: { fontFamily: 'Lato_900Black', fontSize: 13, letterSpacing: 0.6 },
  }),
);
