import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Chip, GlossFill, glossShadow, IconButton, useTabBarInset } from '@/components/ui';
import { useT } from '@/lib/i18n';
import SessionsFeed from '../../components/SessionsFeed';
import { supabase } from '../../lib/supabase';

import { useTheme, makeStyles, type Theme, fonts, radius, space, type } from '@/lib/theme';
const CATEGORIES = ['Semua', 'Running', 'Badminton', 'Gym', 'Futsal', 'Basket', 'Tennis'];

interface SportEvent {
  id: string;
  title: string;
  organizer: string;
  date: string;
  location: string;
  city: string;
  category: string;
  type: 'Kompetisi' | 'Fun Run' | 'Open Tournament' | 'Komunitas' | 'Festival';
  participants: string;
  image: string;
  isFeatured?: boolean;
  price: string;
}



export default function ExploreScreen() {
  const t = useTheme();
  const styles = useStylesTheme();
  const tr = useT();
  const tabInset = useTabBarInset();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<'events' | 'sessions'>('events');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('events').select('*');
      if (error) throw error;
      // map backend keys to frontend keys if they differ
      const formatted = (data || []).map((e: any) => ({
        ...e,
        image: e.image_url, // map image_url to image
      }));
      setEvents(formatted);
    } catch (e) {
      console.error('Error fetching events:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents =
    selectedCategory === 'Semua'
      ? events
      : events.filter((e) => e.category === selectedCategory);

  const featured = selectedCategory === 'Semua' ? events.find((e) => e.isFeatured) : null;
  const listEvents = selectedCategory === 'Semua'
    ? events.filter((e) => !e.isFeatured)
    : filteredEvents;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ExpoStatusBar style="auto" />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} accessibilityRole="header">{tr('explore.title')}</Text>
          <Text style={styles.headerSubtitle}>{segment === 'events' ? tr('explore.subtitle') : tr('sessions.subtitle')}</Text>
        </View>
        <IconButton icon="notifications-outline" accessibilityLabel={tr('explore.notifications')} />
      </View>

      <View style={styles.segment} accessibilityRole="tablist">
        {(['events', 'sessions'] as const).map((k) => {
          const on = segment === k;
          return (
            <Pressable
              key={k}
              onPress={() => setSegment(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segmentItem, on && styles.segmentOn]}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {k === 'events' ? tr('explore.events') : tr('sessions.title')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {segment === 'sessions' ? (
        <SessionsFeed />
      ) : (
      <>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={t.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={tr('explore.search')}
          placeholderTextColor={t.textMuted}
          selectionColor={t.primary}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList} style={styles.categoryScroll}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={cat === 'Semua' ? tr('explore.all') : cat}
            selected={selectedCategory === cat}
            onPress={() => setSelectedCategory(cat)}
          />
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: tabInset + 80, paddingTop: 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchEvents();
            }}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
      >
        {featured && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{tr('explore.featured')}</Text>
            <Pressable
              style={({ pressed }) => [styles.featuredCard, pressed && { transform: [{ scale: 0.99 }] }]}
              onPress={() => router.push(`/events/${featured.id}`)}
              accessibilityRole="button"
            >
              <Image source={{ uri: featured.image }} style={styles.featuredImage} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.95)']}
                locations={[0, 0.4, 1]}
                style={styles.featuredGradient}
              >
                <View style={styles.featuredBadgeRow}>
                  <View style={styles.onPhotoBadge}>
                    <Text style={styles.onPhotoBadgeText}>{featured.type}</Text>
                  </View>
                  <View style={styles.onPhotoBadge}>
                    <Ionicons name="fitness-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.onPhotoBadgeText}>{featured.category}</Text>
                  </View>
                </View>

                <Text style={styles.featuredTitle}>{featured.title}</Text>

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.metaText}>{featured.date}</Text>
                  <Text style={styles.metaText}>·</Text>
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.metaText}>{featured.city}</Text>
                </View>

                <View style={styles.featuredFooter}>
                  <View style={styles.onPhotoBadge}>
                    <Ionicons name="people-outline" size={13} color="#FFFFFF" />
                    <Text style={styles.onPhotoBadgeText}>{featured.participants}</Text>
                  </View>
                  <View style={styles.registerBtn}>
                    <GlossFill />
                    <Text style={styles.registerBtnText}>{tr('explore.register', { price: featured.price })}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tr('explore.allEvents')}</Text>
          {loading ? (
            <ActivityIndicator color={t.primary} style={{ marginTop: 40 }} />
          ) : listEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={44} color={t.textMuted} />
              <Text style={styles.emptyTitle}>{tr('explore.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{tr('explore.emptyBody')}</Text>
            </View>
          ) : (
            listEvents.map((event) => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [styles.eventCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/events/${event.id}`)}
                accessibilityRole="button"
              >
                <Image source={{ uri: event.image }} style={styles.eventImage} resizeMode="cover" />
                <View style={styles.eventInfo}>
                  <View style={styles.eventTopRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{event.type}</Text>
                    </View>
                    <Text style={styles.eventPrice}>{event.price}</Text>
                  </View>

                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.eventOrganizer}>{event.organizer}</Text>

                  <View style={styles.eventMeta}>
                    <View style={styles.eventMetaItem}>
                      <Ionicons name="calendar-outline" size={13} color={t.textSecondary} />
                      <Text style={styles.eventMetaText}>{event.date}</Text>
                    </View>
                    <View style={styles.eventMetaItem}>
                      <Ionicons name="location-outline" size={13} color={t.textSecondary} />
                      <Text style={styles.eventMetaText} numberOfLines={1}>{event.city}</Text>
                    </View>
                  </View>

                  <View style={styles.eventMetaItem}>
                    <Ionicons name="people-outline" size={13} color={t.textSecondary} />
                    <Text style={styles.eventMetaText}>{event.participants}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: tabInset + 8 }, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => router.push('/events/create')}
        accessibilityRole="button"
        accessibilityLabel={tr('explore.createEvent')}
      >
        <View style={styles.fabClip}>
          <GlossFill />
        </View>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
      </>
      )}
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm },
  headerTitle: { ...type.title, color: t.text },
  headerSubtitle: { ...type.callout, color: t.textSecondary, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: t.surfaceMuted,
  },
  segmentItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: t.ink },
  segmentText: { ...type.label, color: t.textSecondary },
  segmentTextOn: { color: t.onInk },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    marginHorizontal: space.md,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: t.text, ...type.body, outlineWidth: 0 } as any,
  categoryScroll: { flexGrow: 0 },
  categoryList: { paddingHorizontal: space.md, gap: space.xs, paddingVertical: space.sm },
  scroll: { paddingHorizontal: space.md },
  section: { marginBottom: space.lg },
  sectionLabel: { ...type.heading, color: t.text, marginBottom: space.sm },
  featuredCard: { height: 220, borderRadius: radius.sheet - 4, overflow: 'hidden', backgroundColor: t.surfaceMuted },
  featuredImage: { ...StyleSheet.absoluteFill },
  featuredGradient: { ...StyleSheet.absoluteFill, padding: space.md, justifyContent: 'flex-end' },
  featuredBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: space.xs },
  onPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  onPhotoBadgeText: { ...type.caption, fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  featuredTitle: { ...type.heading, fontSize: 22, lineHeight: 28, color: '#FFFFFF', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: space.sm },
  metaText: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  featuredFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  registerBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, overflow: 'hidden' },
  registerBtnText: { ...type.label, fontSize: 14, color: '#FFFFFF' },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: t.surfaceMuted,
  },
  typeBadgeText: { ...type.caption, fontSize: 12, fontFamily: fonts.bodyBold, color: t.text },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: t.surface,
    borderRadius: radius.card + 4,
    overflow: 'hidden',
    marginBottom: space.sm,
  },
  eventImage: { width: 108, minHeight: 136, backgroundColor: t.surfaceMuted },
  eventInfo: { flex: 1, padding: space.sm, paddingLeft: space.md, justifyContent: 'space-between' },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eventTitle: { ...type.subheading, fontSize: 16, color: t.text, marginBottom: 2 },
  eventOrganizer: { ...type.caption, color: t.textSecondary, marginBottom: 8 },
  eventPrice: { ...type.caption, fontFamily: fonts.bodyBold, color: t.primaryText },
  eventMeta: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  eventMetaText: { ...type.caption, color: t.textSecondary, flexShrink: 1 },
  emptyContainer: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: space.xl },
  emptyTitle: { ...type.heading, color: t.text, marginTop: space.sm, marginBottom: 6 },
  emptySubtitle: { ...type.callout, color: t.textSecondary, textAlign: 'center' },
  fab: { position: 'absolute', right: space.md, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', ...glossShadow },
  fabClip: { ...StyleSheet.absoluteFill, borderRadius: 29, overflow: 'hidden' },
}));
