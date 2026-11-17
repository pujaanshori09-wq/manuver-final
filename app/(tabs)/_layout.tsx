import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { FloatingTabBar, type TabIcon } from '@/components/ui/TabBar';
import { useT } from '@/lib/i18n';
import { supabase } from '../../lib/supabase';
import { registerForPushNotifications, savePushToken } from '../../lib/pushNotifications';

// Same icons as before — only the container was restyled.
const ICONS: Record<string, TabIcon> = {
  index: { on: 'flame', off: 'flame-outline', size: 24 },
  explore: { on: 'compass', off: 'compass-outline', size: 24 },
  matches: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

export default function TabLayout() {
  const tr = useT();

  useEffect(() => {
    async function setupPush() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(session.user.id, token);
      }
    }
    setupPush();
  }, []);

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
