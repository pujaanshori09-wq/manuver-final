import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, ThemeScope, type, useTheme } from '@/lib/theme';
import { Glass } from './Glass';
import { GlossFill } from './Gloss';

export const TAB_BAR_HEIGHT = 64;
const TAB_BAR_GAP = 8;

/** Space a tab screen must leave at the bottom so content clears the floating bar. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + TAB_BAR_GAP * 2 + Math.max(insets.bottom - 6, 6);
}

export type TabIcon = { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; size?: number };

/**
 * Floating frosted pill. Icons are the app's existing set; only the container changed.
 * The active tab sits on the glossy-orange capsule. The bar follows Discover into dark.
 */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  icons,
  forceDarkOn = [],
}: BottomTabBarProps & { icons: Record<string, TabIcon>; forceDarkOn?: string[] }) {
  const focusedName = state.routes[state.index]?.name;
  const bar = (
    <Bar state={state} descriptors={descriptors} emitter={emitter} navigateToTab={navigateToTab} icons={icons} />
  );
  return forceDarkOn.includes(focusedName) ? <ThemeScope scheme="dark">{bar}</ThemeScope> : bar;
}

function Bar({ state, descriptors, emitter, navigateToTab, icons }: Pick<BottomTabBarProps, 'state' | 'descriptors' | 'emitter' | 'navigateToTab'> & { icons: Record<string, TabIcon> }) {
  const t = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom - 6, 6) + TAB_BAR_GAP }]}>
      <Glass style={s.bar} intensity={70}>
        {state.routes.map((route, index) => {
          const icon = icons[route.name];
          if (!icon) return null; // hidden routes (href: null)
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const focused = state.index === index;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [s.item, pressed && !focused && { opacity: 0.6 }]}
            >
              {focused && (
                <View style={s.activePill}>
                  <GlossFill />
                </View>
              )}
              <Ionicons
                name={focused ? icon.on : icon.off}
                size={icon.size ?? 23}
                color={focused ? t.onPrimary : t.textSecondary}
              />
              <Text numberOfLines={1} style={[s.label, { color: focused ? t.onPrimary : t.textSecondary }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 16, right: 16 },
    bar: {
      height: TAB_BAR_HEIGHT,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: t.scheme === 'dark' ? 0.5 : 0.12,
      shadowRadius: 20,
      elevation: 10,
    },
    item: {
      flex: 1,
      height: TAB_BAR_HEIGHT - 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    activePill: {
      ...StyleSheet.absoluteFill,
      borderRadius: 999,
      overflow: 'hidden',
    },
    label: { ...type.caption, fontFamily: 'Lato_700Bold', fontSize: 12, lineHeight: 15 },
  }),
);
