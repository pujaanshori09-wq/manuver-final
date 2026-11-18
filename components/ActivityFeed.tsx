import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityCard } from '@/components/ActivityCard';
import { Button, useTabBarInset } from '@/components/ui';
import { formatKm } from '@/lib/activity';
import { clearDraft, loadDraft, type Draft } from '@/lib/activityDraft';
import { activitiesApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

/** Explore → Activity: start a recording, finish an interrupted one, and see your history. */
export default function ActivityFeed() {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
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
        data.map((a) => <ActivityCard key={a.id} a={a} />)
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: space.md, paddingTop: space.xs, gap: space.sm },
    draft: { backgroundColor: t.surface, borderRadius: radius.card, padding: space.md, gap: space.xs, borderWidth: 1.5, borderColor: t.primary },
    draftTitle: { ...type.subheading, color: t.text },
    draftBody: { ...type.callout, color: t.textSecondary },
    draftActions: { flexDirection: 'row', gap: space.xs, marginTop: space.xxs },
    empty: { alignItems: 'center', gap: space.xs, paddingVertical: space.xxl },
    emptyTitle: { ...type.subheading, color: t.text },
    emptyBody: { ...type.callout, color: t.textSecondary, textAlign: 'center' },
  }),
);
