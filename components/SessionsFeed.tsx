import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CreateEmergencySheet from './CreateEmergencySheet';
import CreateSessionSheet from './CreateSessionSheet';
import DaruratKurang1Board from './DaruratKurang1Board';
import { Button, Chip, GlossFill, glossShadow, useTabBarInset } from '@/components/ui';
import { useLanguage, useT } from '@/lib/i18n';
import { assetUrl, sessionsApi, type OpenSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { apiErrorMessage } from '@/lib/api/errors';

import { useTheme, makeStyles, type Theme, fonts, radius, space, type } from '@/lib/theme';
export interface SessionItem {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string;
  sport: string;
  title: string;
  venue_name: string;
  scheduled_at: string;
  slots_total: number;
  slots_filled: number;
  gender_pref: 'any' | 'male' | 'female';
  skill_note?: string | null;
  status: 'open' | 'full' | 'cancelled' | 'completed';
  is_joined: boolean;
}

// Valid Ionicons mapping for sport badges & filters
const SPORT_FILTERS = [
  { id: 'all', label: 'Semua', icon: 'grid-outline' as const },
  { id: 'badminton', label: 'Badminton', icon: 'tennisball-outline' as const },
  { id: 'running', label: 'Running', icon: 'walk-outline' as const },
  { id: 'gym', label: 'Gym', icon: 'barbell-outline' as const },
  { id: 'tennis', label: 'Tennis', icon: 'tennisball-outline' as const },
  { id: 'futsal', label: 'Futsal', icon: 'football-outline' as const },
  { id: 'basket', label: 'Basket', icon: 'basketball-outline' as const },
];

const SPORT_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  badminton: 'tennisball-outline',
  running: 'walk-outline',
  gym: 'barbell-outline',
  tennis: 'tennisball-outline',
  futsal: 'football-outline',
  basket: 'basketball-outline',
  yoga: 'body-outline',
  cycling: 'bicycle-outline',
};

/** Server session → the shape the cards render. */
const GENDER = { ALL: 'any', MEN: 'male', WOMEN: 'female' } as const;
function toItem(s: OpenSession): SessionItem {
  return {
    id: s.id,
    creator_id: s.creator.id,
    creator_name: s.creator.name,
    creator_avatar: assetUrl(s.creator.photoUrl) ?? DEFAULT_AVATAR,
    sport: s.sport,
    title: s.title,
    venue_name: s.venueName,
    scheduled_at: s.scheduledAt,
    slots_total: s.slotsTotal,
    slots_filled: s.slotsFilled,
    gender_pref: GENDER[s.genderPref],
    skill_note: s.skillNote,
    status: s.status === 'FULL' ? 'full' : 'open',
    is_joined: s.isJoined,
  };
}

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';

/**
 * Open sparring feed, shown as the second segment of the Explore tab.
 * The SOS board ("one player short") sits on top of the list.
 */
export default function SessionsFeed() {
  const t = useTheme();
  const styles = useStylesTheme();
  const tr = useT();
  const { language } = useLanguage();
  const tabInset = useTabBarInset();
  const [sosVisible, setSosVisible] = useState(false);
  const [sosKey, setSosKey] = useState(0);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sheetVisible, setSheetVisible] = useState<boolean>(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const { me } = useAuth();
  const currentUserId = me?.id ?? null;

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setSessions((await sessionsApi.list()).map(toItem));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
  };

  const handleJoinLeave = async (session: SessionItem) => {
    if (!currentUserId) {
      Alert.alert(tr('sessions.signInTitle'), tr('sessions.signInBody'));
      return;
    }

    try {
      setActionInProgressId(session.id);
      // The server checks the slots, the time and who may join.
      if (session.is_joined) await sessionsApi.leave(session.id);
      else await sessionsApi.join(session.id);

      fetchSessions();
    } catch (err: any) {
      Alert.alert(tr('sessions.failedTitle'), apiErrorMessage(err, tr));
    } finally {
      setActionInProgressId(null);
    }
  };

  const formatIndonesianDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const days = language === 'id' ? ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months =
        language === 'id'
          ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} · ${hours}:${minutes} WIB`;
    } catch {
      return isoString;
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (selectedSport === 'all') return true;
    return s.sport.toLowerCase() === selectedSport.toLowerCase();
  });

  const renderCard = ({ item }: { item: SessionItem }) => {
    const isFull = item.slots_filled >= item.slots_total || item.status === 'full';
    const progressPercent = Math.min((item.slots_filled / item.slots_total) * 100, 100);
    const isProcessing = actionInProgressId === item.id;

    const genderLabel =
      item.gender_pref === 'male'
        ? tr('sessions.menOnly')
        : item.gender_pref === 'female'
        ? tr('sessions.womenOnly')
        : tr('sessions.anyGender');

    const sportIcon = SPORT_ICON_MAP[item.sport.toLowerCase()] || 'fitness-outline';

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.sportBadge}>
            <Ionicons name={sportIcon} size={14} color={t.primaryText} />
            <Text style={styles.sportBadgeText}>{item.sport}</Text>
          </View>
          <View style={styles.genderBadge}>
            <Text style={styles.genderBadgeText}>{genderLabel}</Text>
          </View>
        </View>

        <Text style={styles.sessionTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.creatorRow}>
          <Image source={{ uri: item.creator_avatar }} style={styles.creatorAvatar} />
          <Text style={styles.creatorName}>{tr('sessions.host', { name: item.creator_name || tr('sessions.member') })}</Text>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={t.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.venue_name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={t.textSecondary} />
            <Text style={styles.infoText}>{formatIndonesianDate(item.scheduled_at)}</Text>
          </View>
        </View>

        <View style={styles.slotsHeader}>
          <Text style={styles.slotsLabel}>{tr('sessions.slots')}</Text>
          <Text style={[styles.slotsValue, isFull && { color: t.danger }]}>
            {tr('sessions.slotCount', { filled: item.slots_filled, total: item.slots_total })}
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]}>
            {!isFull && <GlossFill highlight={false} />}
            {isFull && <View style={[StyleSheet.absoluteFill, { backgroundColor: t.danger }]} />}
          </View>
        </View>

        {item.skill_note ? (
          <Text style={styles.skillNoteText} numberOfLines={2}>
            {tr('sessions.note', { note: item.skill_note })}
          </Text>
        ) : null}

        <Button
          label={item.is_joined ? tr('sessions.leave') : isFull ? tr('sessions.full') : tr('sessions.join')}
          variant={item.is_joined ? 'tertiary' : 'primary'}
          size="md"
          onPress={() => handleJoinLeave(item)}
          disabled={!item.is_joined && isFull}
          loading={isProcessing}
          style={{ marginTop: space.md }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filterScroll}
      >
        {SPORT_FILTERS.map((f) => (
          <Chip
            key={f.id}
            icon={f.icon}
            label={f.id === 'all' ? tr('explore.all') : f.label}
            selected={selectedSport === f.id}
            onPress={() => setSelectedSport(f.id)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={t.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          ListHeaderComponent={
            // Remount on a new post so the board refetches immediately.
            <DaruratKurang1Board key={sosKey} onOpenCreate={() => setSosVisible(true)} />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: tabInset + 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="tennisball-outline" size={36} color={t.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>{tr('sessions.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{tr('sessions.emptyBody')}</Text>
              <Button
                label={tr('sessions.createFirst')}
                icon="add"
                onPress={() => setSheetVisible(true)}
                style={{ alignSelf: 'stretch', marginTop: space.xl }}
              />
            </View>
          }
        />
      )}

      {/* The empty state has its own button; avoid two "create" actions on top of each other. */}
      {!loading && filteredSessions.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.fab, { bottom: tabInset + 8 }, pressed && { transform: [{ scale: 0.95 }] }]}
          onPress={() => setSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={tr('sessions.create')}
        >
          <View style={styles.fabClip}>
            <GlossFill />
          </View>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <CreateSessionSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onCreated={() => fetchSessions()} />
      <CreateEmergencySheet
        visible={sosVisible}
        onClose={() => setSosVisible(false)}
        onSuccess={() => setSosKey((k) => k + 1)}
      />
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screenHeader: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.xs },
  screenTitle: { ...type.title, color: t.text },
  screenSubtitle: { ...type.callout, color: t.textSecondary, marginTop: 2 },
  filterScroll: { paddingHorizontal: space.md, gap: space.xs, paddingVertical: space.sm },
  listContent: { paddingHorizontal: space.md, paddingTop: space.xs, gap: space.sm, flexGrow: 1 },
  card: { backgroundColor: t.surface, borderRadius: radius.sheet - 4, padding: space.lg },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: t.primarySoft,
  },
  sportBadgeText: { ...type.caption, fontFamily: fonts.bodyBold, color: t.primaryText, textTransform: 'capitalize' },
  genderBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: t.surfaceMuted },
  genderBadgeText: { ...type.caption, fontFamily: fonts.bodyBold, color: t.textSecondary },
  sessionTitle: { ...type.heading, color: t.text },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  creatorAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.surfaceMuted },
  creatorName: { ...type.callout, color: t.textSecondary },
  infoBlock: { gap: 6, marginTop: space.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  infoText: { ...type.callout, color: t.text, flexShrink: 1 },
  slotsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, marginBottom: 6 },
  slotsLabel: { ...type.caption, color: t.textSecondary },
  slotsValue: { ...type.caption, fontFamily: fonts.bodyBold, color: t.text },
  progressBarTrack: { height: 8, borderRadius: 4, backgroundColor: t.surfaceMuted, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  skillNoteText: { ...type.caption, color: t.textSecondary, marginTop: space.sm },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, paddingVertical: space.xxxl },
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
  fab: { position: 'absolute', right: space.md, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', ...glossShadow },
  fabClip: { ...StyleSheet.absoluteFill, borderRadius: 29, overflow: 'hidden' },
}));
