import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACTIVITY_ICON, ActivityStats } from '@/components/ActivityCard';
import { HoldButton, RoundButton } from '@/components/RecordControls';
import { RouteMap } from '@/components/RouteMap';
import { Button, Chip, Glass, IconButton, TextField, Toggle } from '@/components/ui';
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
  paceColors,
  paceFromSpeed,
  recentSpeed,
  SPEED_LIMITS,
  stepKmh,
  usesSpeed,
  windowKmh,
  type ActivityType,
  type TrackPoint,
} from '@/lib/activity';
import { clearDraft, loadDraft, newClientId, saveDraft } from '@/lib/activityDraft';
import { activitiesApi, ApiError } from '@/lib/api';
import { useT, type TKey } from '@/lib/i18n';
import { fonts, makeStyles, radius, space, type, useTheme } from '@/lib/theme';

type Status = 'ready' | 'recording' | 'paused' | 'auto' | 'vehicle' | 'done';

/** Moves smaller than this between fixes are GPS jitter, not distance. */
const MIN_STEP_M = 2;
/** After an auto-pause, moving this far from where you stopped resumes recording. */
const RESUME_AFTER_M = 10;
const DRAFT_EVERY_MS = 5000;
/** After a vehicle stretch, recording resumes once speed has been back under this share of the limit for 20 s. */
const VEHICLE_CLEAR_RATIO = 0.6;
const VEHICLE_CLEAR_MS = 20_000;

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
  const [view, setView] = useState<'map' | 'stats'>('map'); // map with a panel, or huge numbers only
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
    /** Indices in points where a new segment starts (resume, auto-resume, after a vehicle). */
    segmentStarts: [] as number[],
    /** Fixes seen while in a vehicle, to tell when the person is moving on foot / by bike again. */
    vehicleBuf: [] as TrackPoint[],
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
      segmentStarts: r.segmentStarts,
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
        segmentStarts: d.segmentStarts ?? [],
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

          const limit = SPEED_LIMITS[r.type];
          /** Starts a new segment at p; the jump into it is not route (pause, vehicle). */
          const startSegment = () => {
            if (r.points.length) r.segmentStarts.push(r.points.length);
            r.segment = [p];
            r.points.push(p);
            r.lastMoveAt = Date.now();
          };

          if (st === 'recording') {
            const prev = r.segment[r.segment.length - 1];
            if (!prev) {
              startSegment();
              return;
            }
            const d = metersBetween(prev, p);
            if (d < MIN_STEP_M) return;
            // A single fix far beyond even vehicle-in-the-window speed is a GPS glitch: skip it.
            if (stepKmh(prev, p) > limit.windowKmh * 2) return;
            r.distanceM += d;
            r.segment.push(p);
            r.points.push(p);
            r.lastMoveAt = Date.now();

            // Faster than a human over the last 30 s: take that stretch back out and wait.
            const kmh = windowKmh(r.segment);
            if (kmh !== null && kmh > limit.windowKmh) {
              const cutoff = p[2] - 30_000;
              let first = r.segment.length - 1;
              while (first > 0 && r.segment[first - 1]![2] >= cutoff) first--;
              const keep = Math.max(1, first);
              const dropped = r.segment.slice(keep - 1);
              for (let i = 1; i < dropped.length; i++) r.distanceM -= metersBetween(dropped[i - 1]!, dropped[i]!);
              r.movingSec = Math.max(0, r.movingSec - Math.round((p[2] - r.segment[keep - 1]![2]) / 1000));
              const removed = r.segment.length - keep;
              r.segment = r.segment.slice(0, keep);
              r.points.splice(r.points.length - removed, removed);
              r.segmentStarts = r.segmentStarts.filter((i) => i < r.points.length);
              r.pausedAt = r.segment[r.segment.length - 1] ?? null;
              r.vehicleBuf = [p];
              setStatus('vehicle');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            }
          } else if (st === 'vehicle') {
            r.vehicleBuf.push(p);
            r.vehicleBuf = r.vehicleBuf.filter((q) => p[2] - q[2] <= VEHICLE_CLEAR_MS + 5_000);
            const span = p[2] - r.vehicleBuf[0]![2];
            const kmh = (recentSpeed(r.vehicleBuf, VEHICLE_CLEAR_MS) ?? 0) * 3.6;
            if (span >= VEHICLE_CLEAR_MS && kmh < limit.windowKmh * VEHICLE_CLEAR_RATIO) {
              r.pausedAt = null;
              r.vehicleBuf = [];
              startSegment();
              setStatus('recording');
              Haptics.selectionAsync().catch(() => {});
            }
          } else if (st === 'auto' && r.pausedAt) {
            const moving = (loc.coords.speed ?? 0) > GO_SPEED_MS || metersBetween(r.pausedAt, p) > RESUME_AFTER_M;
            if (moving) {
              r.pausedAt = null;
              startSegment();
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
    if (status !== 'recording' && status !== 'auto' && status !== 'paused' && status !== 'vehicle') return;
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
    Object.assign(r, { type, autoPause, startedAt: Date.now(), lastMoveAt: Date.now(), segment: [], segmentStarts: [] });
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
    r.vehicleBuf = [];
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

  const autoTitle = (t: ActivityType) => tr(TITLE_KEY[dayPart(new Date(r.startedAt))], { type: tr(TYPE_KEY[t]) });
  const tooFastFor = (t: ActivityType) => (r.distanceM / Math.max(1, r.movingSec)) * 3.6 > SPEED_LIMITS[t].avgKmh;

  /** Strava-style: "this doesn't look like a run" with a way out, instead of a bare refusal. */
  const offerOtherType = () => {
    const canRide = r.type !== 'RIDE' && !tooFastFor('RIDE');
    Alert.alert(
      tr('activity.notTypeTitle', { type: tr(TYPE_KEY[r.type]) }),
      canRide ? tr('activity.notTypeBody') : tr('activity.tooFast'),
      [
        ...(canRide
          ? [
              {
                text: tr('activity.switchToRide'),
                onPress: () => {
                  const next = title === autoTitle(r.type) ? autoTitle('RIDE') : title;
                  r.type = 'RIDE';
                  setType('RIDE');
                  setTitle(next);
                  save(next);
                },
              },
            ]
          : []),
        { text: tr('activity.discard'), style: 'destructive' as const, onPress: discard },
        { text: tr('common.cancel'), style: 'cancel' as const },
      ],
    );
  };

  const save = async (titleOverride?: string) => {
    if (tooFastFor(r.type)) {
      offerOtherType();
      return;
    }
    setSaving(true);
    try {
      // Seconds since the start for every point, never going back (GPS clocks can jitter).
      let last = 0;
      const pointTimes = r.points.map((p) => (last = Math.max(last, Math.round((p[2] - r.startedAt) / 1000))));
      const endedAt = Math.max(r.updatedAt || Date.now(), r.startedAt + r.movingSec * 1000, r.startedAt + last * 1000);
      const saved = await activitiesApi.create({
        clientId: r.clientId,
        type: r.type,
        title: (titleOverride ?? title).trim() || tr(TYPE_KEY[r.type]),
        startedAt: new Date(r.startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        movingSec: r.movingSec,
        distanceM: Math.round(r.distanceM),
        polyline: encodeRoute(r.points),
        pointTimes,
        segmentStarts: r.segmentStarts,
        showOnProfile,
      });
      statusRef.current = 'ready';
      await clearDraft();
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      router.replace({ pathname: '/activity/[id]', params: { id: saved.id } });
    } catch (e) {
      // The server checks speeds too; it has the last word.
      if (e instanceof ApiError && e.status === 422) offerOtherType();
      else Alert.alert(tr('activity.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const route = r.points.map((p) => [p[0], p[1]] as [number, number]);
  const live = recentSpeed(r.segment);
  const speedMode = usesSpeed(status === 'ready' ? type : r.type);
  const savable = canSave(r.distanceM, r.movingSec) && r.points.length > 1;
  const recording = status === 'recording' || status === 'auto' || status === 'vehicle';
  const bigNumbers = view === 'stats' && status !== 'done';
  const paceValue = speedMode ? formatSpeed(kmhFromSpeed(live)) : formatPace(paceFromSpeed(live));
  const paceUnit = speedMode ? tr('activity.kmh') : tr('activity.perKm');
  const paceLabel = speedMode ? tr('activity.speed') : tr('activity.pace');
  // GPS health as a coloured dot: amber while searching, red in a vehicle, green when good.
  const dot = !gpsReady ? '#F59E0B' : status === 'vehicle' ? t.danger : status === 'recording' ? t.success : t.textMuted;
  const chipText = !gpsReady
    ? tr('activity.gpsWaiting')
    : status === 'vehicle'
      ? tr('activity.vehicle')
      : status === 'auto'
        ? tr('activity.autoPaused')
        : status === 'paused'
          ? tr('activity.paused')
          : tr(TYPE_KEY[status === 'ready' ? type : r.type]);

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
      <RouteMap
        route={route}
        follow={status !== 'done'}
        inset={cover}
        colors={status !== 'done' ? paceColors(r.points, r.segmentStarts) : undefined}
        style={StyleSheet.absoluteFill}
      />

      {/* Numbers mode: the map steps aside for huge, glanceable numbers. */}
      {bigNumbers && (
        <View style={[s.numbers, { paddingTop: cover.top, paddingBottom: cover.bottom }]}>
          <View style={s.numberBlock}>
            <Text style={s.numberLabel}>{tr('activity.time')}</Text>
            <Text style={s.numberHero} adjustsFontSizeToFit numberOfLines={1}>
              {formatDuration(r.movingSec)}
            </Text>
          </View>
          <View style={s.numberRule} />
          <View style={s.numberBlock}>
            <Text style={s.numberLabel}>{tr('activity.distance')}</Text>
            <Text style={s.numberBig} adjustsFontSizeToFit numberOfLines={1}>
              {formatKm(r.distanceM)}
              <Text style={s.numberUnit}>{' ' + tr('activity.km')}</Text>
            </Text>
          </View>
          <View style={s.numberRule} />
          <View style={s.numberBlock}>
            <Text style={s.numberLabel}>{paceLabel}</Text>
            <Text style={s.numberBig} adjustsFontSizeToFit numberOfLines={1}>
              {paceValue}
              <Text style={s.numberUnit}>{' ' + paceUnit}</Text>
            </Text>
          </View>
        </View>
      )}

      <View
        style={[s.top, { paddingTop: insets.top + space.xs }]}
        onLayout={(e) => {
          const top = Math.round(e.nativeEvent.layout.height);
          setCover((c) => (c.top === top ? c : { ...c, top }));
        }}
      >
        <IconButton icon="chevron-down" accessibilityLabel={tr('common.back')} onPress={() => router.back()} />
        {status !== 'done' && (
          <Glass style={[s.chip, status === 'vehicle' && { backgroundColor: t.dangerSoft }]}>
            <View style={[s.dot, { backgroundColor: dot }]} />
            <Text style={[s.chipText, status === 'vehicle' && { color: t.danger }]} numberOfLines={1}>
              {chipText}
            </Text>
          </Glass>
        )}
        <View style={{ flex: 1 }} />
        {status !== 'done' && (
          <IconButton
            icon={bigNumbers ? 'map-outline' : 'speedometer-outline'}
            accessibilityLabel={bigNumbers ? tr('activity.mapView') : tr('activity.statsView')}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setView(bigNumbers ? 'map' : 'stats');
            }}
          />
        )}
      </View>

      <Glass
        style={[s.panel, { paddingBottom: insets.bottom + space.md }]}
        intensity={80}
      >
        <View
          onLayout={(e) => {
            const bottom = Math.round(e.nativeEvent.layout.height + space.xs + insets.bottom + space.md);
            setCover((c) => (c.bottom === bottom ? c : { ...c, bottom }));
          }}
          style={{ gap: space.sm }}
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
              <Button label={tr('activity.save')} onPress={() => save()} loading={saving} disabled={!savable} />
              <Button label={tr('activity.discard')} variant="ghost" onPress={discard} />
            </ScrollView>
          ) : (
            <>
              <View style={s.handle} />
              {!bigNumbers && (
                <>
                  <View style={s.bigStat}>
                    <Text style={s.bigLabel}>{tr('activity.time')}</Text>
                    <Text style={s.bigValue}>{formatDuration(r.movingSec)}</Text>
                  </View>
                  <View style={s.stats}>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>{tr('activity.distance')}</Text>
                      <Text style={s.statValue}>
                        {formatKm(r.distanceM)}
                        <Text style={s.unit}>{' ' + tr('activity.km')}</Text>
                      </Text>
                    </View>
                    <View style={s.statRule} />
                    <View style={s.stat}>
                      <Text style={s.statLabel}>{paceLabel}</Text>
                      <Text style={s.statValue}>
                        {paceValue}
                        <Text style={s.unit}>{' ' + paceUnit}</Text>
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {status === 'ready' && (
                <View style={s.chips}>
                  {(['RUN', 'RIDE', 'HIKE'] as const).map((k) => (
                    <Chip key={k} label={tr(TYPE_KEY[k])} icon={ACTIVITY_ICON[k]} selected={type === k} onPress={() => setType(k)} />
                  ))}
                </View>
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

              <View style={s.controls}>
                {status === 'ready' ? (
                  <RoundButton icon="play" label={tr('activity.start')} onPress={start} disabled={!gpsReady} />
                ) : recording ? (
                  <RoundButton icon="pause" label={tr('activity.pause')} onPress={pause} pulse={status === 'recording'} />
                ) : (
                  <>
                    <RoundButton icon="play" label={tr('activity.resume')} onPress={resume} />
                    <HoldButton label={tr('activity.finish')} hint={tr('activity.holdToFinish')} onDone={finish} />
                  </>
                )}
              </View>
              {status === 'ready' && <Text style={[s.hint, { textAlign: 'center' }]}>{tr('activity.keepOpen')}</Text>}
            </>
          )}
        </View>
      </Glass>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    center: { alignItems: 'stretch', justifyContent: 'center', padding: space.xl, gap: space.sm },
    top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 36, borderRadius: radius.pill, flexShrink: 1 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { ...type.label, color: t.text, flexShrink: 1 },
    numbers: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, justifyContent: 'center', paddingHorizontal: space.xl },
    numberBlock: { alignItems: 'center', paddingVertical: space.sm },
    numberLabel: { ...type.caption, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
    numberHero: { fontFamily: fonts.display, fontSize: 84, lineHeight: 96, letterSpacing: -2, color: t.text, fontVariant: ['tabular-nums'] },
    numberBig: { fontFamily: fonts.display, fontSize: 56, lineHeight: 66, letterSpacing: -1.4, color: t.text, fontVariant: ['tabular-nums'] },
    numberUnit: { fontFamily: fonts.body, fontSize: 20, letterSpacing: 0, color: t.textSecondary },
    numberRule: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginHorizontal: space.xxl },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '75%',
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.lg,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: t.border, marginBottom: space.xxs },
    panelTitle: { ...type.heading, color: t.text },
    bigStat: { alignItems: 'center' },
    bigLabel: { ...type.caption, color: t.textSecondary },
    bigValue: { fontFamily: fonts.display, fontSize: 56, lineHeight: 64, letterSpacing: -1.6, color: t.text, fontVariant: ['tabular-nums'] },
    stats: { flexDirection: 'row', alignItems: 'center' },
    stat: { flex: 1, alignItems: 'center' },
    statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: t.border },
    statLabel: { ...type.caption, color: t.textSecondary },
    statValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: t.text, fontVariant: ['tabular-nums'] },
    unit: { fontFamily: fonts.body, fontSize: 14, letterSpacing: 0, color: t.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowLabel: { ...type.label, color: t.text },
    hint: { ...type.caption, color: t.textSecondary },
    controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: space.xxl, paddingTop: space.xs },
  }),
);
