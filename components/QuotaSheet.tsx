import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { ProBadge } from '@/components/ui/ProBadge';
import type { SwipeLimit } from '@/lib/api';
import { useLanguage, useT, type TKey } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

const COPY: Record<SwipeLimit['kind'], { icon: keyof typeof Ionicons.glyphMap; title: TKey; body: TKey }> = {
  like: { icon: 'heart', title: 'quota.likeTitle', body: 'quota.likeBody' },
  super: { icon: 'star', title: 'quota.superTitle', body: 'quota.superBody' },
  rate: { icon: 'hourglass-outline', title: 'quota.rateTitle', body: 'quota.rateBody' },
};

/**
 * Shown when the server refuses a swipe: today's Likes or this week's Super Likes are used up,
 * or the person is swiping faster than the limits allow. The server decides; this only explains.
 */
export function QuotaSheet({ limit, onClose }: { limit: SwipeLimit | null; onClose: () => void }) {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  if (!limit) return null;

  const copy = COPY[limit.kind];
  const at = new Date(limit.resetsAt);
  // Daily Likes and speed limits come back within a day: the clock time says it. The weekly
  // Super Like also needs the day ("Senin 00.00").
  const when =
    limit.kind === 'super'
      ? at.toLocaleString(language, { weekday: 'long', hour: '2-digit', minute: '2-digit' })
      : at.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={tr('common.close')} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}>
        <View style={s.handle} />
        <View style={s.icon}>
          <Ionicons name={copy.icon} size={28} color={t.primary} />
        </View>
        <Text style={s.title}>{tr(copy.title)}</Text>
        <Text style={s.body}>{tr(copy.body, { time: when })}</Text>

        {limit.kind !== 'rate' && (
          <View style={s.premium}>
            <View style={s.premiumHead}>
              <ProBadge tier="pro" />
              <Text style={s.soon}>{tr('quota.soon')}</Text>
            </View>
            {(['quota.perkLikes', 'quota.perkSuper'] as const).map((k) => (
              <View key={k} style={s.perk}>
                <Ionicons name="checkmark-circle" size={18} color={t.primary} />
                <Text style={s.perkText}>{tr(k)}</Text>
              </View>
            ))}
          </View>
        )}

        <Button label={tr('quota.ok')} onPress={onClose} />
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
    icon: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primarySoft,
    },
    title: { ...type.heading, color: t.text, textAlign: 'center' },
    body: { ...type.callout, color: t.textSecondary, textAlign: 'center' },
    premium: { backgroundColor: t.surface, borderRadius: radius.card, padding: space.md, gap: space.xs, marginVertical: space.xs },
    premiumHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    soon: { ...type.caption, color: t.textMuted },
    perk: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    perkText: { ...type.callout, color: t.text, flex: 1 },
  }),
);
