import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACTIVITY_ICON, ActivityStats } from '@/components/ActivityCard';
import { RouteMap } from '@/components/RouteMap';
import { Button, Chip, IconButton, TextField, Toggle } from '@/components/ui';
import {
  AUTO_PAUSE_AFTER_MS,
  GO_SPEED_MS,
  MAX_ACCURACY_M,
  canSave,
  dayPart,
  encodeRoute,
  formatDuration,
  formatKm,
  formatPace,
  formatSpeed,
  kmhFromSpeed,
  metersBetween,
  paceFromSpeed,
  recentSpeed,
  usesSpeed,
  type ActivityType,
  type TrackPoint,
} from '@/lib/activity';
import { clearDraft, loadDraft, newClientId, saveDraft } from '@/lib/activityDraft';
import { activitiesApi } from '@/lib/api';
import { useT, type TKey } from '@/lib/i18n';
import { makeStyles, radius, space, type, useTheme } from '@/lib/theme';

type Status = 'ready' | 'recording' | 'paused' | 'auto' | 'done';

/** Moves smaller than this between fixes are GPS jitter, not distance. */
const MIN_STEP_M = 2;
/** After an auto-pause, moving this far from where you stopped resumes recording. */
const RESUME_AFTER_M = 10;
const DRAFT_EVERY_MS = 5000;

const TYPE_KEY: Record<ActivityType, TKey> = { RUN: 'activity.run', RIDE: 'activity.ride', HIKE: 'activity.hike' };
const TITLE_KEY = {
  Morning: 'activity.titleMorning',
  Afternoon: 'activity.titleAfternoon',
  Evening: 'activity.titleEvening',
  Night: 'activity.titleNight',
} as const satisfies Record<string, TKey>;

/** Record a run, ride or hike with the phone's GPS while the app is open (agreed: foreground only). */
export default function RecordActivity() {
  const s = useStyles();
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ resume?: string; finish?: string }>();

  const [status, setStatusState] = useState<Status>('ready');
  const [type, setType] = useState<ActivityType>('RUN');
  const [autoPause, setAutoPause] = useState(false);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [gpsReady, setGpsReady] = useState(false);
  const [title, setTitle] = useState('');
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setTick] = useState(0); // re-render every second while recording
  const [cover, setCover] = useState({ top: 0, bottom: 0 }); // map area hidden by the header and the panel

  // The location callback outlives renders, so the recording itself lives in refs.
  const statusRef = useRef<Status>('ready');
  const r = useRef({
    clientId: newClientId(),
    type: 'RUN' as ActivityType,
    autoPause: false,
    startedAt: 0,
    updatedAt: 0,
    movingSec: 0,
    distanceM: 0,
    points: [] as TrackPoint[],
    /** Fixes since the last (auto) resume; distance and live pace come from here. */
    segment: [] as TrackPoint[],
    lastMoveAt: 0,
    pausedAt: null as TrackPoint | null,
    lastDraftAt: 0,
  }).current;

  const setStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const persist = useCallback(() => {
    if (!r.startedAt) return;
    r.updatedAt = Date.now();
    r.lastDraftAt = r.updatedAt;
    saveDraft({
      clientId: r.clientId,
      type: r.type,
      startedAt: r.startedAt,
      updatedAt: r.updatedAt,
      movingSec: r.movingSec,
      distanceM: r.distanceM,
      points: r.points,
      autoPause: r.autoPause,
    });
  }, [r]);

  const finishForm = useCallback(() => {
    setTitle(tr(TITLE_KEY[dayPart(new Date(r.startedAt))], { type: tr(TYPE_KEY[r.type]) }));
    setStatus('done');
  }, [r, setStatus, tr]);

  // Pick up an interrupted recording from the Activity tab.
  useEffect(() => {
    if (!params.resume) return;
    loadDraft().then((d) => {
      if (!d) return;
      Object.assign(r, {
        clientId: d.clientId,
        type: d.type,
        autoPause: d.autoPause,
        startedAt: d.startedAt,
        updatedAt: d.updatedAt,
        movingSec: d.movingSec,
        distanceM: d.distanceM,
        points: d.points,
        segment: [],
      });
      setType(d.type);
      setAutoPause(d.autoPause);
      if (params.finish) finishForm();
      else setStatus('paused');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GPS: ask once, then watch for as long as the screen is open.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (perm !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      sub = await Location.watchPositionAsync(
        // distanceInterval 0 keeps fixes coming while standing still, which auto-pause needs.
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => {
          const acc = loc.coords.accuracy;
          if (acc === null || acc > MAX_ACCURACY_M) return;
          setGpsReady(true);
          const p: TrackPoint = [loc.coords.latitude, loc.coords.longitude, loc.timestamp];
          const st = statusRef.current;

          if (st === 'recording') {
            const prev = r.segment[r.segment.length - 1];
            if (!prev) {
              r.segment.push(p);
              r.points.push(p);
              r.lastMoveAt = Date.now();
              return;
            }
            const d = metersBetween(prev, p);
            if (d < MIN_STEP_M) return;
            r.distanceM += d;
            r.segment.push(p);
            r.points.push(p);
            r.lastMoveAt = Date.now();
          } else if (st === 'auto' && r.pausedAt) {
            const moving = (loc.coords.speed ?? 0) > GO_SPEED_MS || metersBetween(r.pausedAt, p) > RESUME_AFTER_M;
            if (moving) {
              r.pausedAt = null;
              r.segment = [p];
              r.points.push(p);
              r.lastMoveAt = Date.now();
              setStatus('recording');
              Haptics.selectionAsync().catch(() => {});
            }
          }
        },
      );
      if (!alive) sub.remove();
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [r, setStatus]);

  // One-second clock: moving time, auto-pause and the local draft.
  useEffect(() => {
    if (status !== 'recording' && status !== 'auto' && status !== 'paused') return;
    const id = setInterval(() => {
      const st = statusRef.current;
      if (st === 'recording') {
        r.movingSec += 1;
        if (r.autoPause && r.lastMoveAt && Date.now() - r.lastMoveAt > AUTO_PAUSE_AFTER_MS) {
          r.pausedAt = r.segment[r.segment.length - 1] ?? null;
          setStatus('auto');
          Haptics.selectionAsync().catch(() => {});
        }
      }
      if (Date.now() - r.lastDraftAt >= DRAFT_EVERY_MS) persist();
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [status, r, persist, setStatus]);

  // Screen stays on while a recording is open (foreground-only tracking needs it). Keyed on
  // "open", not on status, so pausing does not release and re-take the lock mid-activation.
  const open = status !== 'ready' && status !== 'done';
  useEffect(() => {
    if (!open) return;
    const taken = activateKeepAwakeAsync('activity').catch(() => {});
    return () => {
      taken.then(() => deactivateKeepAwake('activity')).catch(() => {});
    };
  }, [open]);

  // Leaving mid-recording keeps it as a draft; the Activity tab offers to continue or save it.
  useEffect(() => () => {
    if (statusRef.current !== 'ready' && statusRef.current !== 'done') persist();
  }, [persist]);

  const start = () => {
    Object.assign(r, { type, autoPause, startedAt: Date.now(), lastMoveAt: Date.now(), segment: [] });
    setStatus('recording');
    persist();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const pause = () => {
    setStatus('paused');
    persist();
  };

  const resume = () => {
    r.segment = [];
    r.pausedAt = null;
    r.lastMoveAt = Date.now();
    setStatus('recording');
  };

  const finish = () => {
    persist();
    finishForm();
  };

  const discard = () =>
    Alert.alert(tr('activity.discardConfirm'), undefined, [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('activity.discard'),
        style: 'destructive',
        onPress: async () => {
          statusRef.current = 'ready';
          await clearDraft();
          router.back();
        },
      },
    ]);

  const save = async () => {
    setSaving(true);
    try {
      const endedAt = r.updatedAt || Date.now();
      const saved = await activitiesApi.create({
        clientId: r.clientId,
        type: r.type,
        title: title.trim() || tr(TYPE_KEY[r.type]),
        startedAt: new Date(r.startedAt).toISOString(),
        endedAt: new Date(Math.max(endedAt, r.startedAt + r.movingSec * 1000)).toISOString(),
        movingSec: r.movingSec,
        distanceM: Math.round(r.distanceM),
        polyline: encodeRoute(r.points),
        showOnProfile,
      });
      statusRef.current = 'ready';
      await clearDraft();
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      router.replace({ pathname: '/activity/[id]', params: { id: saved.id } });
    } catch {
      Alert.alert(tr('activity.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const route = r.points.map((p) => [p[0], p[1]] as [number, number]);
  const live = recentSpeed(r.segment);
  const speedMode = usesSpeed(status === 'ready' ? type : r.type);
  const savable = canSave(r.distanceM, r.movingSec) && r.points.length > 1;

  if (permission === 'denied') {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <Text style={s.panelTitle}>{tr('activity.permissionTitle')}</Text>
        <Text style={s.hint}>{tr('activity.permissionBody')}</Text>
        <Button label={tr('activity.openSettings')} onPress={() => Linking.openSettings()} />
        <Button label={tr('common.cancel')} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RouteMap route={route} follow={status !== 'done'} inset={cover} style={StyleSheet.absoluteFill} />

      <View
        style={[s.top, { paddingTop: insets.top + space.xs }]}
        onLayout={(e) => {
          const top = Math.round(e.nativeEvent.layout.height);
          setCover((c) => (c.top === top ? c : { ...c, top }));
        }}
      >
        <IconButton
          icon="chevron-down"
          accessibilityLabel={tr('common.back')}
          onPress={() => router.back()}
        />
        {status !== 'done' && (
          <View style={s.pill}>
            <Text style={s.pillText}>
              {!gpsReady
                ? tr('activity.gpsWaiting')
                : status === 'auto'
                  ? tr('activity.autoPaused')
                  : status === 'paused'
                    ? tr('activity.paused')
                    : tr(TYPE_KEY[status === 'ready' ? type : r.type])}
            </Text>
          </View>
        )}
      </View>

      <View
        style={[s.panel, { paddingBottom: insets.bottom + space.md }]}
        onLayout={(e) => {
          const bottom = Math.round(e.nativeEvent.layout.height);
          setCover((c) => (c.bottom === bottom ? c : { ...c, bottom }));
        }}
      >
        {status === 'done' ? (
          <ScrollView contentContainerStyle={{ gap: space.sm }} keyboardShouldPersistTaps="handled">
            <Text style={s.panelTitle}>{tr('activity.saveTitle')}</Text>
            <ActivityStats a={{ type: r.type, distanceM: r.distanceM, movingSec: Math.max(r.movingSec, 1) }} />
            <TextField label={tr('activity.titleLabel')} value={title} onChangeText={setTitle} maxLength={80} />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{tr('activity.showOnProfile')}</Text>
                <Text style={s.hint}>{tr('activity.showOnProfileHint')}</Text>
              </View>
              <Toggle value={showOnProfile} onValueChange={setShowOnProfile} accessibilityLabel={tr('activity.showOnProfile')} />
            </View>
            {!savable && <Text style={[s.hint, { color: t.danger }]}>{tr('activity.tooShort')}</Text>}
            <Button label={tr('activity.save')} onPress={save} loading={saving} disabled={!savable} />
            <Button label={tr('activity.discard')} variant="ghost" onPress={discard} />
          </ScrollView>
        ) : (
          <>
            <View style={s.bigStat}>
              <Text style={s.bigLabel}>{tr('activity.time')}</Text>
              <Text style={s.bigValue}>{formatDuration(r.movingSec)}</Text>
            </View>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statLabel}>{tr('activity.distance')}</Text>
                <Text style={s.statValue}>
                  {formatKm(r.distanceM)} <Text style={s.unit}>{tr('activity.km')}</Text>
                </Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>{speedMode ? tr('activity.speed') : tr('activity.pace')}</Text>
                <Text style={s.statValue}>
                  {speedMode ? formatSpeed(kmhFromSpeed(live)) : formatPace(paceFromSpeed(live))}{' '}
                  <Text style={s.unit}>{speedMode ? tr('activity.kmh') : tr('activity.perKm')}</Text>
                </Text>
              </View>
            </View>

            {status === 'ready' && (
              <>
                <Text style={s.statLabel}>{tr('activity.chooseType')}</Text>
                <View style={s.chips}>
                  {(['RUN', 'RIDE', 'HIKE'] as const).map((k) => (
                    <Chip key={k} label={tr(TYPE_KEY[k])} icon={ACTIVITY_ICON[k]} selected={type === k} onPress={() => setType(k)} />
                  ))}
                </View>
              </>
            )}

            {(status === 'ready' || status === 'paused') && (
              <View style={s.row}>
                <Text style={[s.rowLabel, { flex: 1 }]}>{tr('activity.autoPause')}</Text>
                <Toggle
                  value={autoPause}
                  onValueChange={(v) => {
                    setAutoPause(v);
                    r.autoPause = v;
                  }}
                  accessibilityLabel={tr('activity.autoPause')}
                />
              </View>
            )}

            {status === 'ready' ? (
              <>
                <Button label={tr('activity.start')} icon="play" onPress={start} disabled={!gpsReady} />
                <Text style={[s.hint, { textAlign: 'center' }]}>{tr('activity.keepOpen')}</Text>
              </>
            ) : status === 'recording' || status === 'auto' ? (
              <Button label={tr('activity.pause')} icon="pause" variant="secondary" onPress={pause} />
            ) : (
              <View style={s.controls}>
                <Button label={tr('activity.resume')} icon="play" style={{ flex: 1 }} onPress={resume} />
                <Button label={tr('activity.finish')} icon="flag" variant="secondary" style={{ flex: 1 }} onPress={finish} />
              </View>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    center: { alignItems: 'stretch', justifyContent: 'center', padding: space.xl, gap: space.sm },
    top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md },
    pill: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: t.surface },
    pillText: { ...type.label, color: t.text },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '75%',
      backgroundColor: t.bg,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.lg,
      paddingTop: space.lg,
      gap: space.sm,
    },
    panelTitle: { ...type.heading, color: t.text },
    bigStat: { alignItems: 'center' },
    bigLabel: { ...type.caption, color: t.textSecondary },
    bigValue: { ...type.hero, fontSize: 52, lineHeight: 58, color: t.text, fontVariant: ['tabular-nums'] },
    stats: { flexDirection: 'row', gap: space.sm },
    stat: { flex: 1, alignItems: 'center' },
    statLabel: { ...type.caption, color: t.textSecondary },
    statValue: { ...type.title, color: t.text, fontVariant: ['tabular-nums'] },
    unit: { ...type.callout, color: t.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowLabel: { ...type.label, color: t.text },
    hint: { ...type.caption, color: t.textSecondary },
    controls: { flexDirection: 'row', gap: space.xs },
  }),
);
