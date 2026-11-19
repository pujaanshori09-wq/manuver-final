import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { LANGUAGES, useT, type Language } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

const ITEM_H = 44;
const VISIBLE = 5; // odd, so one row sits in the middle

/**
 * Bottom sheet with a scroll wheel of languages (same look on iOS and Android).
 * The language only changes when "Select" is pressed.
 */
export function LanguageWheel({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: Language;
  onSelect: (l: Language) => void;
  onClose: () => void;
}) {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const wheel = useRef<ScrollViewInstance>(null);
  const start = Math.max(0, LANGUAGES.findIndex((l) => l.code === value));
  const [index, setIndex] = useState(start);

  // Every time the sheet opens, start on the current language.
  useEffect(() => {
    if (!visible) return;
    setIndex(start);
    const id = setTimeout(() => wheel.current?.scrollTo({ y: start * ITEM_H, animated: false }), 0);
    return () => clearTimeout(id);
  }, [visible, start]);

  const settle = (y: number) => {
    const i = Math.min(LANGUAGES.length - 1, Math.max(0, Math.round(y / ITEM_H)));
    if (i !== index) {
      setIndex(i);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={tr('common.cancel')} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}>
        <View style={s.handle} />
        <Text style={s.title} accessibilityRole="header">
          {tr('language.title')}
        </Text>

        <View style={{ height: ITEM_H * VISIBLE }}>
          {/* Band marking the row that will be chosen */}
          <View pointerEvents="none" style={[s.band, { top: ITEM_H * Math.floor(VISIBLE / 2) }]} />
          <ScrollView
            ref={wheel}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={(e) => settle(e.nativeEvent.contentOffset.y)}
            onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
            contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
            accessibilityRole="adjustable"
          >
            {LANGUAGES.map((l, i) => {
              const d = Math.abs(i - index);
              return (
                <Pressable
                  key={l.code}
                  style={s.item}
                  onPress={() => wheel.current?.scrollTo({ y: i * ITEM_H, animated: true })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: d === 0 }}
                  accessibilityLabel={l.native}
                >
                  <Text
                    numberOfLines={1}
                    style={[s.itemText, d === 0 ? s.itemOn : { opacity: d === 1 ? 0.55 : 0.28 }]}
                  >
                    {l.native}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.actions}>
          <Button label={tr('common.cancel')} variant="tertiary" size="md" style={{ flex: 1 }} onPress={onClose} />
          <Button
            label={tr('common.select')}
            size="md"
            style={{ flex: 1 }}
            onPress={() => {
              onSelect(LANGUAGES[index]!.code);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: t.scrim },
    sheet: {
      backgroundColor: t.bg,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.lg,
      paddingTop: space.xs,
      gap: space.sm,
    },
    handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.border, marginBottom: space.xxs },
    title: { ...type.heading, color: t.text, textAlign: 'center' },
    band: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: ITEM_H,
      borderRadius: radius.md,
      backgroundColor: t.surfaceMuted,
    },
    item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
    itemText: { ...type.body, fontSize: 18, color: t.text },
    itemOn: { fontFamily: type.label.fontFamily, color: t.text },
    actions: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  }),
);
