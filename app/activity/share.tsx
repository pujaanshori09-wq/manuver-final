import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { ShareCard, type CardStats, type CardTemplate } from '@/components/ShareCard';
import { Button, Chip, IconButton } from '@/components/ui';
import { decodeRoute, formatDuration, formatKm, formatPace, formatSpeed, trimEnds, usesSpeed } from '@/lib/activity';
import { activitiesApi, type Activity } from '@/lib/api';
import { useT, type TKey } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

const TEMPLATES: { id: CardTemplate; label: TKey; icon: 'sparkles-outline' | 'map-outline' }[] = [
  { id: 'clear', label: 'share.templateClear', icon: 'sparkles-outline' },
  { id: 'map', label: 'share.templateMap', icon: 'map-outline' },
];

/** Share an activity: a card image to Instagram / TikTok / WhatsApp, or its public link. */
export default function ShareActivity() {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width: screenW } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = ['activities', 'one', id];
  const card = useRef<ViewInstance>(null);

  const [template, setTemplate] = useState<CardTemplate>('clear');
  const [stats, setStats] = useState<CardStats>({ distance: true, pace: true, time: true });
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const { data: a, isLoading } = useQuery({ queryKey: key, enabled: !!id, queryFn: () => activitiesApi.get(id) });

  const toggleStat = (k: keyof CardStats) =>
    setStats((cur) => {
      const next = { ...cur, [k]: !cur[k] };
      return Object.values(next).some(Boolean) ? next : cur; // keep at least one number on the card
    });

  const shareImage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(tr('share.webOnly'));
      return;
    }
    setBusy(true);
    try {
      // 1080 px wide: crisp in Instagram / TikTok stories; the clear template keeps its transparency.
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', width: 1080 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: tr('share.title') });
    } catch {
      Alert.alert(tr('share.failed'));
    } finally {
      setBusy(false);
    }
  };

  /** The public link, after asking to switch it on when it is still off. */
  const ensureLink = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (!a) return resolve(null);
      if (a.isPublic && a.publicUrl) return resolve(a.publicUrl);
      Alert.alert(tr('share.enableTitle'), tr('share.enableBody'), [
        { text: tr('common.cancel'), style: 'cancel', onPress: () => resolve(null) },
        {
          text: tr('share.enable'),
          onPress: async () => {
            try {
              const updated = await activitiesApi.update(id, { isPublic: true });
              queryClient.setQueryData<Activity>(key, updated);
              queryClient.invalidateQueries({ queryKey: ['activities'] });
              resolve(updated.publicUrl ?? null);
            } catch {
              Alert.alert(tr('share.failed'));
              resolve(null);
            }
          },
        },
      ]);
    });

  const summary = (x: Activity) =>
    `${formatKm(x.distanceM)} km · ${
      usesSpeed(x.type)
        ? `${formatSpeed(x.distanceM / 1000 / (x.movingSec / 3600))} km/h`
        : `${formatPace(x.movingSec / (x.distanceM / 1000))} /km`
    } · ${formatDuration(x.movingSec)}`;

  const shareLink = async () => {
    const url = await ensureLink();
    if (!url || !a) return;
    await Share.share({ message: `${tr('share.linkText', { title: a.title, summary: summary(a) })}\n${url}`, url }).catch(() => {});
  };

  const copyLink = async () => {
    const url = await ensureLink();
    if (!url) return;
    await Clipboard.setStringAsync(url);
    Alert.alert(tr('share.copied'));
  };

  const cardW = Math.min(screenW - space.lg * 2, 300);
  // Shared images go to strangers: cut the route ends like the public page does.
  const route = a ? trimEnds(decodeRoute(a.route)) : [];
  const canMap = route.length > 1;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <IconButton icon="chevron-back" accessibilityLabel={tr('common.back')} onPress={() => router.back()} />
        <Text style={s.title} accessibilityRole="header">
          {tr('share.title')}
        </Text>
      </View>

      {isLoading || !a ? (
        <ActivityIndicator color={t.primary} style={{ marginTop: space.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={s.stage}>
            {template === 'clear' && (
              // Sample "photo" behind the transparent sticker; it is not part of the shared image.
              <LinearGradient colors={['#3B4A5E', '#1F2A36', '#0E1217']} style={StyleSheet.absoluteFill} />
            )}
            <ShareCard ref={card} a={a} route={route} template={template} stats={stats} width={cardW} onReady={setMapReady} />
          </View>
          {template === 'clear' && <Text style={s.hint}>{tr('share.previewHint')}</Text>}

          <View style={s.chips}>
            {TEMPLATES.filter((x) => x.id !== 'map' || canMap).map((x) => (
              <Chip key={x.id} label={tr(x.label)} icon={x.icon} selected={template === x.id} onPress={() => setTemplate(x.id)} />
            ))}
          </View>
          <View style={s.chips}>
            <Chip label={tr('activity.distance')} icon="resize-outline" selected={stats.distance} onPress={() => toggleStat('distance')} />
            <Chip
              label={usesSpeed(a.type) ? tr('activity.speed') : tr('activity.pace')}
              icon="speedometer-outline"
              selected={stats.pace}
              onPress={() => toggleStat('pace')}
            />
            <Chip label={tr('activity.time')} icon="time-outline" selected={stats.time} onPress={() => toggleStat('time')} />
          </View>

          <Button
            label={tr('share.shareImage')}
            icon="image-outline"
            onPress={shareImage}
            loading={busy || (template === 'map' && !mapReady)}
          />
          <Button label={tr('share.shareLink')} icon="link-outline" variant="secondary" onPress={shareLink} />
          <Button label={tr('share.copyLink')} icon="copy-outline" variant="ghost" onPress={copyLink} />
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
    scroll: { paddingHorizontal: space.lg, gap: space.sm },
    stage: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.card, overflow: 'hidden', paddingVertical: space.md, backgroundColor: t.surfaceMuted },
    hint: { ...type.caption, color: t.textSecondary, textAlign: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: 'center' },
  }),
);
