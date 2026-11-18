import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityCard } from '@/components/ActivityCard';
import { Button } from '@/components/ui';
import type { Activity } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { makeStyles, space, type } from '@/lib/theme';

/** The latest three activities shown on a profile, plus "See all". `userId` = someone else's profile. */
export function ProfileActivities({ activities, userId, style }: { activities: Activity[]; userId?: string; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  const tr = useT();
  const router = useRouter();

  if (!activities.length) return <Text style={[s.empty, style]}>{tr('activity.emptyTitle')}</Text>;

  return (
    <View style={[s.list, style]}>
      {activities.slice(0, 3).map((a) => (
        <ActivityCard key={a.id} a={a} />
      ))}
      <Button
        label={tr('activity.seeAll')}
        variant="tertiary"
        size="md"
        onPress={() => router.push(userId ? `/activity/list?userId=${userId}` : '/activity/list')}
      />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    list: { paddingHorizontal: space.lg, gap: space.sm },
    empty: { ...type.callout, color: t.textSecondary, paddingHorizontal: space.lg },
  }),
);
