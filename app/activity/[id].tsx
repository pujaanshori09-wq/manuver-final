import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACTIVITY_ICON, ActivityStats } from '@/components/ActivityCard';
import { RouteMap } from '@/components/RouteMap';
import { Button, IconButton, Toggle } from '@/components/ui';
import { decodeRoute } from '@/lib/activity';
import { activitiesApi, type Activity } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage, useT } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

export default function ActivityDetail() {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const { language } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = ['activities', 'one', id];

  const { data: a, isLoading, error, refetch } = useQuery({
    queryKey: key,
    enabled: !!id,
    queryFn: () => activitiesApi.get(id),
  });

  const own = !!a && a.userId === me?.id;

  const setFlag = async (flag: 'showOnProfile' | 'isPublic', v: boolean) => {
    queryClient.setQueryData<Activity>(key, (old) => (old ? { ...old, [flag]: v } : old));
    try {
      // The server answer carries the public link once it exists.
      queryClient.setQueryData<Activity>(key, await activitiesApi.update(id, { [flag]: v }));
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    } catch {
      queryClient.setQueryData<Activity>(key, (old) => (old ? { ...old, [flag]: !v } : old));
      Alert.alert(tr('sheets.error'));
    }
  };
  const share = () => router.push({ pathname: '/activity/share', params: { id } });

  const remove = () =>
    Alert.alert(tr('activity.deleteConfirm'), undefined, [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('activity.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await activitiesApi.remove(id);
            queryClient.invalidateQueries({ queryKey: ['activities'] });
            router.back();
          } catch {
            Alert.alert(tr('sheets.error'));
          }
        },
      },
    ]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <IconButton icon="chevron-back" accessibilityLabel={tr('common.back')} onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        {own && <IconButton icon="share-outline" accessibilityLabel={tr('share.title')} onPress={share} />}
      </View>

      {isLoading ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: space.xxl }} />
      ) : !a || error ? (
        <View style={s.center}>
          <Text style={s.hint}>{tr('activity.loadFailed')}</Text>
          <Button label={tr('discover.refresh')} variant="ghost" onPress={() => refetch()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={s.titleRow}>
            <View style={s.icon}>
              <Ionicons name={ACTIVITY_ICON[a.type]} size={20} color={t.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title}>{a.title}</Text>
              <Text style={s.hint}>
                {new Date(a.startedAt).toLocaleString(language, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <RouteMap route={decodeRoute(a.route)} interactive style={s.map} />
          <ActivityStats a={a} size="lg" />

          {own && (
            <>
              <Button label={tr('share.title')} icon="share-social-outline" onPress={share} />
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{tr('share.publicLink')}</Text>
                  <Text style={s.hint}>{tr('share.publicLinkHint')}</Text>
                  {a.isPublic && a.publicUrl ? (
                    <Text style={[s.hint, { color: t.primaryText }]} selectable numberOfLines={1}>
                      {a.publicUrl}
                    </Text>
                  ) : null}
                </View>
                <Toggle value={!!a.isPublic} onValueChange={(v) => setFlag('isPublic', v)} accessibilityLabel={tr('share.publicLink')} />
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{tr('activity.showOnProfile')}</Text>
                  <Text style={s.hint}>{tr('activity.showOnProfileHint')}</Text>
                </View>
                <Toggle value={a.showOnProfile} onValueChange={(v) => setFlag('showOnProfile', v)} accessibilityLabel={tr('activity.showOnProfile')} />
              </View>
              <Button label={tr('activity.delete')} variant="danger" icon="trash-outline" onPress={remove} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.xs },
    center: { alignItems: 'center', paddingTop: space.xxl, gap: space.xs },
    scroll: { paddingHorizontal: space.md, gap: space.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primarySoft },
    title: { ...type.title, color: t.text },
    hint: { ...type.caption, color: t.textSecondary },
    map: { height: 320, borderRadius: radius.card, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: t.surface, borderRadius: radius.card, padding: space.md },
    rowLabel: { ...type.label, color: t.text },
  }),
);
