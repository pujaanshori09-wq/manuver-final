import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityCard } from '@/components/ActivityCard';
import { IconButton } from '@/components/ui';
import { activitiesApi, usersApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { makeStyles, space, type, useTheme } from '@/lib/theme';

/** "See all" from a profile: your own profile activities, or a matched player's (?userId=). */
export default function ActivityList() {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId?: string }>();

  // shortcut: the latest 50 only, no paging; add `before=` paging when histories get long.
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['activities', 'list', userId ?? 'me'],
    queryFn: () => (userId ? usersApi.activities(userId) : activitiesApi.mine({ onProfile: true, limit: 50 })),
  });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <IconButton icon="chevron-back" accessibilityLabel={tr('common.back')} onPress={() => router.back()} />
        <Text style={s.title} accessibilityRole="header">
          {tr('activity.sectionTitle')}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: space.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + space.xl }]}>
          {error ? (
            <Text style={s.hint}>{tr('activity.loadFailed')}</Text>
          ) : data.length === 0 ? (
            <Text style={s.hint}>{tr('activity.emptyTitle')}</Text>
          ) : (
            data.map((a) => <ActivityCard key={a.id} a={a} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs },
    title: { ...type.heading, color: t.text },
    scroll: { paddingHorizontal: space.md, gap: space.sm },
    hint: { ...type.callout, color: t.textSecondary, textAlign: 'center', marginTop: space.xl },
  }),
);
