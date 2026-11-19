import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { FloatingTabBar, type TabIcon } from '@/components/ui/TabBar';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { listenForPushTaps, syncPushToken } from '../../lib/pushNotifications';

// Same icons as before — only the container was restyled.
const ICONS: Record<string, TabIcon> = {
  index: { on: 'flame', off: 'flame-outline', size: 24 },
  explore: { on: 'compass', off: 'compass-outline', size: 24 },
  matches: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

export default function TabLayout() {
  const tr = useT();

  const { me } = useAuth();
  const router = useRouter();

  // Signed in: register this phone for pushes (the server sends them), and open the chat a push is about.
  useEffect(() => {
    if (!me?.id) return;
    syncPushToken();
    let stop = () => {};
    listenForPushTaps((matchId) => router.push({ pathname: '/chat/[id]', params: { id: matchId } })).then((s) => (stop = s));
    return () => stop();
  }, [me?.id, router]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} forceDarkOn={['index']} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: tr('tabs.discover') }} />
      <Tabs.Screen name="explore" options={{ title: tr('tabs.explore') }} />
      <Tabs.Screen name="matches" options={{ title: tr('tabs.chat') }} />
      <Tabs.Screen name="profile" options={{ title: tr('tabs.profile') }} />
    </Tabs>
  );
}
