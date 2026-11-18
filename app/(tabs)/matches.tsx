import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, GlossFill, useTabBarInset } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { assetUrl, chatApi } from '@/lib/api';

import { useTheme, makeStyles, type Theme, fonts, radius, space, type } from '@/lib/theme';
interface MatchUser {
  id: string;
  matchId: string;
  name: string;
  avatar: string;
  isNew?: boolean;
}

interface ConversationItem {
  id: string;
  partnerId: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
}

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80';

/** "14:05" for today, "18 Nov" for older. */
function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function MatchesScreen() {
  const t = useTheme();
  const styles = useStylesTheme();
  const tr = useT();
  const tabInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [newMatches, setNewMatches] = useState<MatchUser[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatchesAndChats = useCallback(async () => {
    try {
      const chats = await chatApi.list();
      const avatarOf = (url: string | null) => assetUrl(url) ?? FALLBACK_AVATAR;
      // Matches without a message yet sit in the "new" row; the rest are conversations.
      setNewMatches(
        chats
          .filter((c) => !c.lastMessage)
          .map((c) => ({ id: c.partner.id, matchId: c.id, name: c.partner.name, avatar: avatarOf(c.partner.photoUrl), isNew: true })),
      );
      setConversations(
        chats
          .filter((c) => c.lastMessage)
          .map((c) => ({
            id: c.id,
            partnerId: c.partner.id,
            name: c.partner.name,
            avatar: avatarOf(c.partner.photoUrl),
            lastMessage: c.lastMessage!.content,
            timestamp: shortTime(c.lastMessage!.createdAt),
            unreadCount: c.unreadCount,
          })),
      );
    } catch {
      // Keep what is on screen; pull to refresh tries again.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the tab comes back into view (e.g. after reading a chat).
  useFocusEffect(
    useCallback(() => {
      fetchMatchesAndChats();
    }, [fetchMatchesAndChats]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatchesAndChats();
  };

  // `id` is the match id (the chat room); `partnerId` is the other player's profile id.
  const openChat = (id: string, name: string, avatar: string, partnerId: string) => {
    router.push({
      pathname: `/chat/[id]`,
      params: { id, name, avatar, partnerId },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ExpoStatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">{tr('chat.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : newMatches.length === 0 && conversations.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingBottom: tabInset }]}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="chatbubbles-outline" size={38} color={t.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>{tr('chat.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{tr('chat.emptyBody')}</Text>
          <Button
            label={tr('chat.emptyCta')}
            onPress={() => router.push('/(tabs)')}
            style={{ alignSelf: 'stretch', marginTop: space.xl }}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
          }
          contentContainerStyle={{ paddingBottom: tabInset + space.md }}
        >
          {newMatches.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>
                {tr('chat.newMatches')} <Text style={{ color: t.primaryText }}>{newMatches.length}</Text>
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchesScroll}>
                {newMatches.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.newMatchItem, pressed && { opacity: 0.8 }]}
                    onPress={() => openChat(item.matchId, item.name || tr('chat.partner'), item.avatar, item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={item.name || tr('chat.partner')}
                  >
                    <View style={styles.ring}>
                      <GlossFill highlight={false} />
                      <Image source={{ uri: item.avatar }} style={styles.newMatchAvatar} />
                    </View>
                    <Text style={styles.newMatchName} numberOfLines={1}>
                      {item.name || tr('chat.partner')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {conversations.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{tr('chat.messages')}</Text>
            <View style={styles.list}>
              {conversations.map((item, i) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.chatRow, pressed && { backgroundColor: t.surfacePressed }]}
                  onPress={() => openChat(item.id, item.name || tr('chat.partner'), item.avatar, item.partnerId)}
                  accessibilityRole="button"
                >
                  <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
                  <View style={[styles.chatContent, i > 0 && styles.chatDivider]}>
                    <View style={styles.chatTopLine}>
                      <Text style={styles.chatPartnerName} numberOfLines={1}>{item.name || tr('chat.partner')}</Text>
                      <Text style={styles.chatTimestamp}>{item.timestamp || tr('chat.justNow')}</Text>
                    </View>
                    <View style={styles.chatBottomLine}>
                      <Text style={styles.chatLastMessage} numberOfLines={1}>
                        {item.lastMessage || tr('chat.startChat')}
                      </Text>
                      {item.unreadCount ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.xs, minHeight: 52, justifyContent: 'center' },
  headerTitle: { ...type.title, color: t.text },
  sectionContainer: { marginTop: space.md },
  sectionTitle: { ...type.heading, color: t.text, paddingHorizontal: space.md, marginBottom: space.sm },
  matchesScroll: { paddingHorizontal: space.md, gap: space.md, paddingVertical: 2 },
  newMatchItem: { alignItems: 'center', width: 76 },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newMatchAvatar: { width: '100%', height: '100%', borderRadius: 35, borderWidth: 2.5, borderColor: t.bg, backgroundColor: t.surfaceMuted },
  newMatchName: { ...type.label, fontSize: 14, color: t.text, marginTop: 6, textAlign: 'center' },
  list: { marginHorizontal: space.md, backgroundColor: t.surface, borderRadius: radius.sheet - 4, overflow: 'hidden' },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.md },
  chatAvatar: { width: 54, height: 54, borderRadius: 27, marginRight: space.sm, backgroundColor: t.surfaceMuted },
  chatContent: { flex: 1, paddingVertical: space.md, paddingRight: space.md },
  chatDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  chatTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: space.xs },
  chatPartnerName: { ...type.subheading, color: t.text, flexShrink: 1 },
  chatTimestamp: { ...type.caption, color: t.textMuted },
  chatBottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMessage: { ...type.callout, color: t.textSecondary, flex: 1, marginRight: 10 },
  unreadBadge: {
    backgroundColor: t.primary,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { ...type.caption, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  emptyTitle: { ...type.title, color: t.text, textAlign: 'center', marginBottom: space.xs },
  emptySubtitle: { ...type.body, color: t.textSecondary, textAlign: 'center' },
}));
