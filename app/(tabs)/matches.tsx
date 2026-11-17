import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, GlossFill, useTabBarInset } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { supabase } from '../../lib/supabase';

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
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      if (!currentUserId) {
        setNewMatches([]);
        setConversations([]);
        return;
      }

      // Fetch matches from Supabase
      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .select(`
          id,
          created_at,
          user_a_id,
          user_b_id,
          user_a:profiles!matches_user_a_id_fkey(id, nama, foto_url),
          user_b:profiles!matches_user_b_id_fkey(id, nama, foto_url)
        `)
        .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (matchError || !matchRows || matchRows.length === 0) {
        setNewMatches([]);
        setConversations([]);
        return;
      }

      const parsedMatches: MatchUser[] = [];
      const parsedConversations: ConversationItem[] = [];

      for (const m of matchRows) {
        const rawPartner = m.user_a_id === currentUserId ? m.user_b : m.user_a;
        const partner = Array.isArray(rawPartner) ? rawPartner[0] : rawPartner;
        if (!partner) continue;

        parsedMatches.push({
          id: partner.id,
          matchId: m.id,
          name: partner.nama || '',
          avatar: partner.foto_url || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
          isNew: true,
        });

        parsedConversations.push({
          id: m.id,
          partnerId: partner.id,
          name: partner.nama || '',
          avatar: partner.foto_url || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
          // Empty = translated placeholders at render time.
          lastMessage: '',
          timestamp: '',
        });
      }

      setNewMatches(parsedMatches);
      setConversations(parsedConversations);
    } catch {
      setNewMatches([]);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMatchesAndChats();
  }, [fetchMatchesAndChats]);

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
