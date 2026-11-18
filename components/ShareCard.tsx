import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { formatDuration, formatKm, formatPace, formatSpeed, usesSpeed, type LatLng } from '@/lib/activity';
import type { Activity } from '@/lib/api';
import { useLanguage, useT, type TKey } from '@/lib/i18n';
import { fonts } from '@/lib/theme';

export type CardTemplate = 'clear' | 'map';
export type CardStats = { distance: boolean; pace: boolean; time: boolean };

const TYPE_KEY: Record<Activity['type'], TKey> = { RUN: 'activity.run', RIDE: 'activity.ride', HIKE: 'activity.hike' };
/** Designed at 360 pt wide; everything scales with the card width. */
const BASE = 360;
const ORANGE = '#FF6A2F';

/** Route as an SVG line fitted into a box (the transparent sticker). */
function RouteLine({ route, w, h }: { route: LatLng[]; w: number; h: number }) {
  if (route.length < 2) return <View style={{ width: w, height: h }} />;
  const k = Math.cos((route[0]![0] * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => -p[0]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-9);
  const pad = 10;
  const scale = Math.min((w - 2 * pad) / Math.max(maxX - minX, span * 0.05), (h - 2 * pad) / Math.max(maxY - minY, span * 0.05));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  const points = xs.map((x, i) => `${(ox + (x - minX) * scale).toFixed(1)},${(oy + (ys[i]! - minY) * scale).toFixed(1)}`).join(' ');
  const sw = Math.max(3, w / 55);
  return (
    <Svg width={w} height={h}>
      <Polyline points={points} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={sw * 3} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points={points} fill="none" stroke={ORANGE} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Map mode: OpenStreetMap tiles laid out by hand (Web Mercator), so a screenshot of the
//    card always contains the map. A live MapView often captures black on Android. ─────────

/** Each 256 px tile is drawn this many points wide: ~2.7 px per point keeps 1080 px exports sharp. */
const TILE_PT = 96;
const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

function MapTiles({ route, w, h, k, onReady }: { route: LatLng[]; w: number; h: number; k: number; onReady?: (ready: boolean) => void }) {
  const xs = route.map((p) => mercX(p[1]));
  const ys = route.map((p) => mercY(p[0]));
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Biggest zoom where the route fits in ~75% of the box.
  const fit = Math.min((w * 0.75) / Math.max(maxX - minX, 1e-9), (h * 0.7) / Math.max(maxY - minY, 1e-9));
  const z = Math.max(3, Math.min(18, Math.floor(Math.log2(fit / TILE_PT))));
  const world = TILE_PT * 2 ** z;
  const left = ((minX + maxX) / 2) * world - w / 2;
  const top = ((minY + maxY) / 2) * world - h / 2;

  const tiles: { x: number; y: number; px: number; py: number }[] = [];
  for (let tx = Math.floor(left / TILE_PT); tx * TILE_PT < left + w; tx++) {
    for (let ty = Math.floor(top / TILE_PT); ty * TILE_PT < top + h; ty++) {
      tiles.push({ x: ((tx % 2 ** z) + 2 ** z) % 2 ** z, y: ty, px: tx * TILE_PT - left, py: ty * TILE_PT - top });
    }
  }

  // Sharing waits until every tile has loaded (or failed), so the image is never half-drawn.
  const settled = useRef(0);
  const key = `${z}:${left.toFixed(1)}:${top.toFixed(1)}`;
  useEffect(() => {
    settled.current = 0;
    onReady?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const done = () => {
    settled.current += 1;
    if (settled.current === tiles.length) onReady?.(true);
  };

  const points = route.map((p) => `${(mercX(p[1]) * world - left).toFixed(1)},${(mercY(p[0]) * world - top).toFixed(1)}`).join(' ');
  const start = route[0]!;
  const end = route[route.length - 1]!;
  const at = (p: LatLng) => ({ cx: mercX(p[1]) * world - left, cy: mercY(p[0]) * world - top });
  const sw = 4.5 * k;

  return (
    <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: '#1b1b1b' }}>
      {tiles.map((t) => (
        <Image
          key={`${t.x}-${t.y}-${t.px}`}
          source={{
            uri: `https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png`,
            // OSM tile policy asks apps to identify themselves.
            headers: { 'User-Agent': 'Manuver/1.0 (activity share card)' },
          }}
          onLoad={done}
          onError={done}
          style={{ position: 'absolute', left: t.px, top: t.py, width: TILE_PT, height: TILE_PT }}
        />
      ))}
      {/* Dims the light OSM style so the orange route and white type stand out. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.42)' }]} />
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Polyline points={points} fill="none" stroke="rgba(255,90,31,0.35)" strokeWidth={sw * 3} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={points} fill="none" stroke={ORANGE} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        <Circle {...at(start)} r={5 * k} fill="#FFFFFF" stroke="#0A0A0A" strokeWidth={2.5 * k} />
        <Circle {...at(end)} r={6 * k} fill={ORANGE} stroke="#0A0A0A" strokeWidth={2.5 * k} />
      </Svg>
      <Text style={{ position: 'absolute', right: 8 * k, bottom: 6 * k, fontSize: 9 * k, color: 'rgba(255,255,255,0.7)' }}>© OpenStreetMap</Text>
    </View>
  );
}

type Props = {
  a: Activity;
  route: LatLng[];
  template: CardTemplate;
  stats: CardStats;
  width: number;
  /** Map mode: false until every map tile has loaded. */
  onReady?: (ready: boolean) => void;
};

/** The image people post: a transparent sticker to lay over a photo, or a 9:16 card with the map. */
export const ShareCard = forwardRef<ViewInstance, Props>(function ShareCard({ a, route, template, stats, width, onReady }, ref) {
  const tr = useT();
  const { language } = useLanguage();
  const k = width / BASE;
  const speed = usesSpeed(a.type);
  const clear = template === 'clear';
  const sub = clear ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.62)';
  const shadow = clear ? { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 * k, textShadowOffset: { width: 0, height: 1 } } : null;

  const items = [
    stats.distance && { label: tr('activity.distance'), value: formatKm(a.distanceM), unit: 'km' },
    stats.pace &&
      (speed
        ? { label: tr('activity.avgSpeed'), value: formatSpeed(a.distanceM / 1000 / (a.movingSec / 3600)), unit: 'km/h' }
        : { label: tr('activity.avgPace'), value: formatPace(a.movingSec / (a.distanceM / 1000)), unit: '/km' }),
    stats.time && { label: tr('activity.time'), value: formatDuration(a.movingSec), unit: '' },
  ].filter(Boolean) as { label: string; value: string; unit: string }[];

  const stat = (it: { label: string; value: string; unit: string }, size: number, align: 'center' | 'flex-start') => (
    <View key={it.label} style={{ alignItems: align, flexShrink: 1 }}>
      <Text numberOfLines={1} style={[{ fontFamily: fonts.bodyBold, fontSize: 12.5 * k, color: sub, letterSpacing: 0.3 * k }, shadow]}>
        {it.label}
      </Text>
      <Text numberOfLines={1} style={[{ fontFamily: fonts.display, fontSize: size * k, lineHeight: size * 1.15 * k, color: '#FFFFFF', letterSpacing: -0.03 * size * k }, shadow]}>
        {it.value}
        {it.unit ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.5 * k, color: 'rgba(255,255,255,0.75)' }}>{` ${it.unit}`}</Text> : null}
      </Text>
    </View>
  );

  const brand = (color: string) => (
    <Text style={[{ fontFamily: fonts.display, fontSize: 22 * k, color, letterSpacing: -0.8 * k }, shadow]}>manuver</Text>
  );

  if (clear) {
    // Transparent PNG: stats, route and brand only, to lay over a photo in a story.
    return (
      <View ref={ref} collapsable={false} style={{ width, alignItems: 'center', paddingVertical: 18 * k, gap: 18 * k, backgroundColor: 'transparent' }}>
        <View style={{ gap: 14 * k, alignItems: 'center' }}>{items.map((it) => stat(it, 44, 'center'))}</View>
        <RouteLine route={route} w={width * 0.62} h={width * 0.5} />
        {brand('#FFFFFF')}
      </View>
    );
  }

  // Map card, 9:16: the map fills the top, the numbers sit on a dark panel below.
  const height = (width * 16) / 9;
  const mapH = Math.round(height * 0.7);
  const date = new Date(a.startedAt).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View ref={ref} collapsable={false} style={{ width, height, overflow: 'hidden', backgroundColor: '#0A0A0A' }}>
      <MapTiles route={route} w={width} h={mapH} k={k} onReady={onReady} />
      <LinearGradient
        colors={['rgba(10,10,10,0)', '#0A0A0A']}
        style={{ position: 'absolute', left: 0, right: 0, top: mapH - 70 * k, height: 70 * k }}
      />
      <View style={{ position: 'absolute', top: 18 * k, left: 20 * k, right: 20 * k, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Both labels sit on dark pills so they read on any map. */}
        <View style={{ paddingHorizontal: 12 * k, paddingVertical: 2 * k, borderRadius: 999, backgroundColor: 'rgba(10,10,10,0.72)' }}>
          {brand('#FF5A1F')}
        </View>
        <View style={{ paddingHorizontal: 12 * k, paddingVertical: 5 * k, borderRadius: 999, backgroundColor: 'rgba(10,10,10,0.72)' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13 * k, color: '#FF8F52' }}>{tr(TYPE_KEY[a.type])}</Text>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 22 * k, paddingTop: 2 * k, paddingBottom: 20 * k, justifyContent: 'space-between' }}>
        <View>
          <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 23 * k, lineHeight: 28 * k, color: '#FFFFFF', letterSpacing: -0.6 * k }}>
            {a.title}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13 * k, color: sub, marginTop: 2 * k }}>{date}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 * k }}>{items.map((it) => stat(it, items.length > 2 ? 27 : 34, 'flex-start'))}</View>
      </View>
    </View>
  );
});
