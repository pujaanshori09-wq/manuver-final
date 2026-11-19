import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteMap } from '@/components/RouteMap';
import { decodeRoute, formatDuration, formatKm, formatPace, formatSpeed, usesSpeed, type ActivityType } from '@/lib/activity';
import type { Activity } from '@/lib/api';
import { useLanguage, useT, type TKey } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';

export const ACTIVITY_ICON: Record<ActivityType, 'walk-outline' | 'bicycle-outline' | 'trail-sign-outline'> = {
  RUN: 'walk-outline',
  RIDE: 'bicycle-outline',
  HIKE: 'trail-sign-outline',
};

const TYPE_KEY: Record<ActivityType, TKey> = { RUN: 'activity.run', RIDE: 'activity.ride', HIKE: 'activity.hike' };

/** Label / value / unit for distance, pace (or speed for rides) and moving time. */
export function useActivityStats(a: Pick<Activity, 'type' | 'distanceM' | 'movingSec'>) {
  const tr = useT();
  const speed = usesSpeed(a.type);
  return [
    { label: tr('activity.distance'), value: formatKm(a.distanceM), unit: tr('activity.km') },
    speed
      ? { label: tr('activity.avgSpeed'), value: formatSpeed(a.distanceM / 1000 / (a.movingSec / 3600)), unit: tr('activity.kmh') }
      : { label: tr('activity.avgPace'), value: formatPace(a.movingSec / (a.distanceM / 1000)), unit: tr('activity.perKm') },
    { label: tr('activity.time'), value: formatDuration(a.movingSec), unit: '' },
  ];
}

/** Strava-style stat row: small grey label above a bold number. Shared by cards and the recorder. */
export function ActivityStats({ a, size = 'md' }: { a: Pick<Activity, 'type' | 'distanceM' | 'movingSec'>; size?: 'md' | 'lg' }) {
  const s = useStyles();
  const items = useActivityStats(a);
  return (
    <View style={s.stats}>
      {items.map((it, i) => (
        <View key={it.label} style={[s.stat, i > 0 && s.statDivider]}>
          <Text style={s.statLabel} numberOfLines={1}>
            {it.label}
          </Text>
          <Text style={[s.statValue, size === 'lg' && s.statValueLg]} numberOfLines={1}>
            {it.value}
            {it.unit ? <Text style={s.unit}>{` ${it.unit}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A feed post for one activity: sport and date, a bold title, the numbers, then the map edge to edge. */
export function ActivityCard({ a, onShare }: { a: Activity; onShare?: () => void }) {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const { language } = useLanguage();
  const when = new Date(a.startedAt);
  const date = when.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = when.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  const route = decodeRoute(a.route);
  const open = () => router.push({ pathname: '/activity/[id]', params: { id: a.id } });

  return (
    <View style={s.card}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${a.title}, ${formatKm(a.distanceM)} km`}
        style={({ pressed }) => pressed && { opacity: 0.92 }}
      >
        <View style={s.body}>
          <View style={s.meta}>
            <View style={s.icon}>
              <Ionicons name={ACTIVITY_ICON[a.type]} size={14} color={t.primary} />
            </View>
            <Text style={s.metaText} numberOfLines={1}>
              {tr(TYPE_KEY[a.type])} · {date} · {time}
            </Text>
          </View>
          <Text style={s.title} numberOfLines={2}>
            {a.title}
          </Text>
          <ActivityStats a={a} />
        </View>
        {route.length > 1 && <RouteMap route={route} style={s.map} />}
      </Pressable>

      {onShare && (
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={tr('share.title')}
          style={({ pressed }) => [s.action, pressed && { backgroundColor: t.surfacePressed }]}
        >
          <Ionicons name="share-outline" size={18} color={t.text} />
          <Text style={s.actionText}>{tr('share.title')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: radius.card + 4, overflow: 'hidden' },
    body: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm, gap: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primarySoft },
    metaText: { ...type.caption, color: t.textSecondary, flex: 1 },
    title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, letterSpacing: -0.4, color: t.text, marginBottom: 4 },
    stats: { flexDirection: 'row' },
    stat: { flex: 1, minWidth: 0 },
    statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.border, paddingLeft: space.sm },
    statLabel: { ...type.caption, color: t.textSecondary },
    statValue: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3, color: t.text, fontVariant: ['tabular-nums'] },
    statValueLg: { fontSize: 26, lineHeight: 32 },
    unit: { fontFamily: fonts.body, fontSize: 13, color: t.textSecondary },
    map: { height: 190 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    actionText: { ...type.label, color: t.text },
  }),
);
