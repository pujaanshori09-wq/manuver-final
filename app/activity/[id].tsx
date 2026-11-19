import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACTIVITY_ICON, useActivityStats } from '@/components/ActivityCard';
import { RouteMap } from '@/components/RouteMap';
import { SpeedChart } from '@/components/SpeedChart';
import { Button, Glass, IconButton, Toggle } from '@/components/ui';
import { decodeRoute, formatDuration, formatPace, formatSpeed, usesSpeed } from '@/lib/activity';
import { activitiesApi, type Activity } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage, useT } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';

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
      const updated = await activitiesApi.update(id, { [flag]: v });
      queryClient.setQueryData<Activity>(key, (old) => (old ? { ...old, ...updated } : updated));
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

  // Strava layout: the map fills the top, a sheet with the numbers slides over it.
  const { height: screenH } = useWindowDimensions();
  const mapH = Math.round(screenH * 0.42);
  const elapsedSec = a ? Math.max(a.movingSec, Math.round((Date.parse(a.endedAt) - Date.parse(a.startedAt)) / 1000)) : 0;
  const stats = useActivityStats(a ?? { type: 'RUN', distanceM: 0, movingSec: 1 });
  // A compact header fades in once the map has scrolled away.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [mapH - 140, mapH - 70], outputRange: [0, 1], extrapolate: 'clamp' });

  if (isLoading || !a || error) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.headerPlain}>
          <IconButton icon="chevron-back" accessibilityLabel={tr('common.back')} onPress={() => router.back()} />
        </View>
        {isLoading ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: space.xxl }} />
        ) : (
          <View style={s.center}>
            <Text style={s.hint}>{tr('activity.loadFailed')}</Text>
            <Button label={tr('discover.refresh')} variant="ghost" onPress={() => refetch()} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Animated.ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View>
          <RouteMap route={decodeRoute(a.route)} interactive hiddenEnds={own} style={{ height: mapH + 24 }} inset={{ bottom: 24 }} />
          {/* The owner sees the whole route; the grey ends are what nobody else sees. */}
          {own && (
            <View style={s.hiddenChip} pointerEvents="none">
              <View style={s.hiddenSwatch} />
              <Text style={s.hiddenText}>{tr('activity.hiddenFromOthers')}</Text>
            </View>
          )}
        </View>

        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.meta}>
            <View style={s.icon}>
              <Ionicons name={ACTIVITY_ICON[a.type]} size={16} color={t.primary} />
            </View>
            <Text style={s.metaText} numberOfLines={2}>
              {new Date(a.startedAt).toLocaleString(language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <Text style={s.title}>{a.title}</Text>

          {/* Two centred columns, like the Strava activity summary */}
          <View style={s.grid}>
            {[...stats, { label: tr('activity.elapsed'), value: formatDuration(elapsedSec), unit: '' }].map((it) => (
              <View key={it.label} style={s.cell}>
                <Text style={s.cellLabel}>{it.label}</Text>
                <Text style={s.cellValue}>
                  {it.value}
                  {it.unit ? <Text style={s.cellUnit}>{' ' + it.unit}</Text> : null}
                </Text>
              </View>
            ))}
          </View>

          {own && <Button label={tr('share.title')} icon="share-social-outline" onPress={share} style={{ marginTop: space.xs }} />}
        </View>

        {a.speed && (
          <>
            <View style={s.band} />
            <View style={s.section}>
              <Text style={s.sectionTitle}>{usesSpeed(a.type) ? tr('activity.speed') : tr('activity.pace')}</Text>
              <SpeedChart
                points={a.speed.points}
                avgKmh={a.distanceM / 1000 / (a.movingSec / 3600)}
                pace={!usesSpeed(a.type)}
                kmLabel={tr('activity.km')}
              />
              {[
                usesSpeed(a.type)
                  ? [tr('activity.avgSpeed'), formatSpeed(a.distanceM / 1000 / (a.movingSec / 3600)) + ' ' + tr('activity.kmh')]
                  : [tr('activity.avgPace'), formatPace(a.movingSec / (a.distanceM / 1000)) + ' ' + tr('activity.perKm')],
                usesSpeed(a.type)
                  ? [tr('activity.maxSpeed'), formatSpeed(a.speed.maxKmh) + ' ' + tr('activity.kmh')]
                  : [tr('activity.maxPace'), formatPace(3600 / a.speed.maxKmh) + ' ' + tr('activity.perKm')],
                [tr('activity.movingTime'), formatDuration(a.movingSec)],
                [tr('activity.elapsed'), formatDuration(elapsedSec)],
              ].map(([label, value]) => (
                <View key={label} style={s.listRow}>
                  <Text style={s.listLabel}>{label}</Text>
                  <Text style={s.listValue}>{value}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {own && (
          <>
            <View style={s.band} />
            <View style={s.section}>
              <Text style={s.sectionTitle}>{tr('activity.privacy')}</Text>
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
              <View style={s.divider} />
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{tr('activity.showOnProfile')}</Text>
                  <Text style={s.hint}>{tr('activity.showOnProfileHint')}</Text>
                </View>
                <Toggle value={a.showOnProfile} onValueChange={(v) => setFlag('showOnProfile', v)} accessibilityLabel={tr('activity.showOnProfile')} />
              </View>
            </View>
            <View style={s.band} />
            <Pressable onPress={remove} accessibilityRole="button" style={({ pressed }) => [s.delete, pressed && { opacity: 0.6 }]}>
              <Ionicons name="trash-outline" size={18} color={t.danger} />
              <Text style={s.deleteText}>{tr('activity.delete')}</Text>
            </Pressable>
          </>
        )}
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[s.stickyWrap, { opacity: headerOpacity }]}>
        <Glass style={[s.sticky, { paddingTop: insets.top, height: insets.top + 60 }]}>
          <Text style={s.stickyTitle} numberOfLines={1}>
            {a.title}
          </Text>
        </Glass>
      </Animated.View>

      {/* Floating round buttons over the map */}
      <View pointerEvents="box-none" style={[s.floating, { top: insets.top + space.xs }]}>
        <IconButton icon="chevron-back" accessibilityLabel={tr('common.back')} onPress={() => router.back()} />
        {own && <IconButton icon="share-outline" accessibilityLabel={tr('share.title')} onPress={share} />}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    headerPlain: { paddingHorizontal: space.md, paddingVertical: space.xs },
    center: { alignItems: 'center', paddingTop: space.xxl, gap: space.xs },
    floating: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between' },
    sheet: {
      marginTop: -24,
      backgroundColor: t.surface,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.lg,
      paddingTop: space.xs,
      paddingBottom: space.lg,
      gap: space.xs,
    },
    handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.border, marginBottom: space.xs },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primarySoft },
    metaText: { ...type.caption, color: t.textSecondary, flex: 1 },
    title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: t.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, marginVertical: space.sm },
    cell: { width: '50%', alignItems: 'center' },
    cellLabel: { ...type.caption, color: t.textSecondary },
    cellValue: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: t.text, fontVariant: ['tabular-nums'] },
    cellUnit: { fontFamily: fonts.body, fontSize: 14, color: t.textSecondary },
    band: { height: 8, backgroundColor: t.bg },
    section: { backgroundColor: t.surface, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
    sectionTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: t.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowLabel: { ...type.label, color: t.text },
    hint: { ...type.caption, color: t.textSecondary },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border },
    delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: space.md, backgroundColor: t.surface },
    deleteText: { ...type.label, color: t.danger },
    hiddenChip: {
      position: 'absolute',
      left: space.md,
      bottom: 24 + space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 30,
      borderRadius: radius.pill,
      backgroundColor: t.glassFallback,
    },
    hiddenSwatch: { width: 16, height: 0, borderTopWidth: 3, borderStyle: 'dashed', borderColor: '#9CA3AF' },
    hiddenText: { ...type.caption, color: t.text },
    listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6 },
    listLabel: { ...type.callout, color: t.textSecondary },
    listValue: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: t.text, fontVariant: ['tabular-nums'] },
    stickyWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
    sticky: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 72,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.hairline,
    },
    stickyTitle: { ...type.subheading, color: t.text },
  }),
);
