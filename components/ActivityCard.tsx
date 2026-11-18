import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteMap } from '@/components/RouteMap';
import { decodeRoute, formatDuration, formatKm, formatPace, formatSpeed, usesSpeed, type ActivityType } from '@/lib/activity';
import type { Activity } from '@/lib/api';
import { useLanguage, useT } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

export const ACTIVITY_ICON: Record<ActivityType, 'walk-outline' | 'bicycle-outline' | 'trail-sign-outline'> = {
  RUN: 'walk-outline',
  RIDE: 'bicycle-outline',
  HIKE: 'trail-sign-outline',
};

/** Distance, moving time and pace (or speed for rides), shared by cards and the detail screen. */
export function ActivityStats({ a, size = 'md' }: { a: Pick<Activity, 'type' | 'distanceM' | 'movingSec'>; size?: 'md' | 'lg' }) {
  const s = useStyles();
  const tr = useT();
  const speed = usesSpeed(a.type);
  const items: [string, string, string][] = [
    [tr('activity.distance'), formatKm(a.distanceM), tr('activity.km')],
    speed
      ? [tr('activity.avgSpeed'), formatSpeed(a.distanceM / 1000 / (a.movingSec / 3600)), tr('activity.kmh')]
      : [tr('activity.avgPace'), formatPace(a.movingSec / (a.distanceM / 1000)), tr('activity.perKm')],
    [tr('activity.time'), formatDuration(a.movingSec), ''],
  ];
  return (
    <View style={s.stats}>
      {items.map(([label, value, unit]) => (
        <View key={label} style={s.stat}>
          <Text style={s.statLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[s.statValue, size === 'lg' && s.statValueLg]} numberOfLines={1}>
            {value}
            {unit ? <Text style={s.unit}>{` ${unit}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ActivityCard({ a }: { a: Activity }) {
  const s = useStyles();
  const t = useTheme();
  const router = useRouter();
  const { language } = useLanguage();
  const date = new Date(a.startedAt).toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
  const route = decodeRoute(a.route);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${a.title}, ${formatKm(a.distanceM)} km`}
      style={({ pressed }) => [s.card, pressed && { backgroundColor: t.surfacePressed }]}
    >
      <View style={s.head}>
        <View style={s.icon}>
          <Ionicons name={ACTIVITY_ICON[a.type]} size={18} color={t.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>
            {a.title}
          </Text>
          <Text style={s.date}>{date}</Text>
        </View>
      </View>
      <ActivityStats a={a} />
      {route.length > 1 && <RouteMap route={route} style={s.map} />}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: radius.card, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: t.border },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primarySoft },
    title: { ...type.subheading, color: t.text },
    date: { ...type.caption, color: t.textSecondary },
    stats: { flexDirection: 'row', gap: space.sm },
    stat: { flex: 1, minWidth: 0 },
    statLabel: { ...type.caption, color: t.textSecondary },
    statValue: { ...type.heading, color: t.text, fontVariant: ['tabular-nums'] },
    statValueLg: { fontSize: 26, lineHeight: 32 },
    unit: { ...type.caption, color: t.textSecondary },
    map: { height: 150, borderRadius: radius.md, overflow: 'hidden' },
  }),
);
