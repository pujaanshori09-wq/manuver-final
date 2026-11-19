import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityCard } from '@/components/ActivityCard';
import { Button, useTabBarInset } from '@/components/ui';
import { formatDuration, formatKm } from '@/lib/activity';
import { clearDraft, loadDraft, type Draft } from '@/lib/activityDraft';
import { activitiesApi } from '@/lib/api';
import { useLanguage, useT } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';

/** Explore → Activity: start a recording, finish an interrupted one, and see your history. */
export default function ActivityFeed() {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const { language } = useLanguage();
  const router = useRouter();
  const tabInset = useTabBarInset();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['activities', 'mine'],
    queryFn: () => activitiesApi.mine(),
  });

  // Back from the recorder: refresh the list and look for an unfinished recording.
  useFocusEffect(
    useCallback(() => {
      refetch();
      loadDraft().then(setDraft);
    }, [refetch]),
  );

  // This week (from Monday), from the activities already loaded: the Strava "You" summary.
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = data.filter((a) => new Date(a.startedAt) >= monday);
  const weekKm = week.reduce((m, a) => m + a.distanceM, 0);
  const weekSec = week.reduce((m, a) => m + a.movingSec, 0);
  // Kilometres per day, Monday to Sunday, for the little bar chart.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const perDay = days.map((d) =>
    week.filter((a) => new Date(a.startedAt).toDateString() === d.toDateString()).reduce((m, a) => m + a.distanceM, 0),
  );
  const maxDay = Math.max(...perDay, 1);
  const today = new Date().toDateString();

  const discardDraft = () =>
    Alert.alert(tr('activity.discardConfirm'), undefined, [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('activity.discard'),
        style: 'destructive',
        onPress: () => clearDraft().then(() => setDraft(null)),
      },
    ]);

  return (
    <ScrollView
      contentContainerStyle={[s.scroll, { paddingBottom: tabInset + space.xl }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={t.primary} />}
    >
      {draft ? (
        <View style={s.draft}>
          <Text style={s.draftTitle}>{tr('activity.draftTitle')}</Text>
          <Text style={s.draftBody}>{tr('activity.draftBody', { distance: formatKm(draft.distanceM) })}</Text>
          <View style={s.draftActions}>
            <Button label={tr('activity.continue')} size="md" style={{ flex: 1 }} onPress={() => router.push('/activity/record?resume=1')} />
            <Button label={tr('activity.save')} size="md" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/activity/record?resume=1&finish=1')} />
          </View>
          <Button label={tr('activity.discard')} size="sm" variant="ghost" onPress={discardDraft} />
        </View>
      ) : (
        <Button label={tr('activity.start')} icon="play" onPress={() => router.push('/activity/record')} />
      )}

      {data.length > 0 && (
        <View style={s.week}>
          <Text style={s.weekTitle}>{tr('activity.thisWeek')}</Text>
          <View style={s.weekRow}>
            <View style={s.weekItem}>
              <Text style={s.weekValue}>
                {formatKm(weekKm)}
                <Text style={s.weekUnit}> {tr('activity.km')}</Text>
              </Text>
              <Text style={s.weekLabel}>{tr('activity.distance')}</Text>
            </View>
            <View style={[s.weekItem, s.weekDivider]}>
              <Text style={s.weekValue}>{formatDuration(weekSec)}</Text>
              <Text style={s.weekLabel}>{tr('activity.time')}</Text>
            </View>
            <View style={[s.weekItem, s.weekDivider]}>
              <Text style={s.weekValue}>{week.length}</Text>
              <Text style={s.weekLabel}>{tr('activity.sectionTitle')}</Text>
            </View>
          </View>
          <View style={s.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {days.map((d, i) => {
              const isToday = d.toDateString() === today;
              return (
                <View key={i} style={s.barCol}>
                  <View style={s.barTrack}>
                    <View
                      style={[
                        s.bar,
                        { height: perDay[i]! > 0 ? `${Math.max(12, (perDay[i]! / maxDay) * 100)}%` : 4 },
                        perDay[i]! > 0 ? { backgroundColor: t.primary } : null,
                      ]}
                    />
                  </View>
                  <Text style={[s.barDay, isToday && { color: t.text, fontFamily: fonts.bodyBold }]}>
                    {d.toLocaleDateString(language, { weekday: 'narrow' })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: space.xl }} />
      ) : error && data.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyBody}>{tr('activity.loadFailed')}</Text>
          <Button label={tr('discover.refresh')} variant="ghost" onPress={() => refetch()} />
        </View>
      ) : data.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="pulse-outline" size={40} color={t.textMuted} />
          <Text style={s.emptyTitle}>{tr('activity.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{tr('activity.emptyBody')}</Text>
        </View>
      ) : (
        data.map((a) => (
          <ActivityCard key={a.id} a={a} onShare={() => router.push({ pathname: '/activity/share', params: { id: a.id } })} />
        ))
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: space.sm, paddingTop: space.xs, gap: space.sm },
    // Draft: orange edge on the left marks it as unfinished, like a pinned item.
    draft: {
      backgroundColor: t.surface,
      borderRadius: radius.card + 4,
      padding: space.md,
      gap: space.xs,
      borderLeftWidth: 4,
      borderLeftColor: t.primary,
    },
    week: { backgroundColor: t.surface, borderRadius: radius.card + 4, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 6 },
    weekTitle: { ...type.label, color: t.textSecondary },
    weekRow: { flexDirection: 'row' },
    weekItem: { flex: 1, minWidth: 0 },
    weekDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.border, paddingLeft: space.sm },
    weekValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: t.text, fontVariant: ['tabular-nums'] },
    weekUnit: { fontFamily: fonts.body, fontSize: 13, color: t.textSecondary },
    weekLabel: { ...type.caption, color: t.textSecondary },
    bars: { flexDirection: 'row', gap: 6, marginTop: space.xs },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barTrack: { height: 44, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    bar: { width: '70%', maxWidth: 22, borderRadius: 4, backgroundColor: t.surfaceMuted },
    barDay: { ...type.caption, color: t.textMuted },
    draftTitle: { ...type.subheading, color: t.text },
    draftBody: { ...type.callout, color: t.textSecondary },
    draftActions: { flexDirection: 'row', gap: space.xs, marginTop: space.xxs },
    empty: { alignItems: 'center', gap: space.xs, paddingVertical: space.xxl },
    emptyTitle: { ...type.subheading, color: t.text },
    emptyBody: { ...type.callout, color: t.textSecondary, textAlign: 'center' },
  }),
);
