/** Pure helpers for GPS activities: route encoding, distance, pace, auto-pause and the local draft. */

export type ActivityType = 'RUN' | 'RIDE' | 'HIKE';
export type LatLng = [number, number];
/** [lat, lng, epoch ms] */
export type TrackPoint = [number, number, number];

// ── Route encoding (Google encoded polyline, precision 5 — same as the server) ─────

export function decodeRoute(str: string): LatLng[] {
  const points: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function encodeValue(v: number) {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodeRoute(points: (LatLng | TrackPoint)[]): string {
  let out = '';
  let pLat = 0;
  let pLng = 0;
  for (const p of points) {
    const lat = Math.round(p[0] * 1e5);
    const lng = Math.round(p[1] * 1e5);
    out += encodeValue(lat - pLat) + encodeValue(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return out;
}

export function metersBetween(a: LatLng | TrackPoint, b: LatLng | TrackPoint) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// ── Recording rules ────────────────────────────────────────────────────────────

/** Fixes worse than this are dropped so GPS noise does not inflate the distance. */
export const MAX_ACCURACY_M = 30;
/** Agreed minimum to save. */
export const MIN_DISTANCE_M = 100;
export const MIN_MOVING_SEC = 60;
/** Auto-pause: still (below STOP) for this long pauses; moving faster than GO resumes. */
export const AUTO_PAUSE_AFTER_MS = 10_000;
export const STOP_SPEED_MS = 0.5;
export const GO_SPEED_MS = 1.0;

export function canSave(distanceM: number, movingSec: number) {
  return distanceM >= MIN_DISTANCE_M && movingSec >= MIN_MOVING_SEC;
}

/**
 * Current speed (m/s) over the last `windowMs` of the segment being recorded. GPS speed is
 * often missing or jumpy on phones; distance over time is steadier.
 */
export function recentSpeed(segment: TrackPoint[], windowMs = 20_000): number | null {
  if (segment.length < 2) return null;
  const last = segment[segment.length - 1]!;
  let meters = 0;
  let i = segment.length - 1;
  while (i > 0 && last[2] - segment[i - 1]![2] <= windowMs) {
    meters += metersBetween(segment[i - 1]!, segment[i]!);
    i--;
  }
  const secs = (last[2] - segment[i]![2]) / 1000;
  return secs >= 3 ? meters / secs : null;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

export function formatKm(meters: number) {
  return (meters / 1000).toFixed(2);
}

export function formatDuration(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** "5:32" per km, or "–" when there is nothing sensible to show. */
export function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm > 60 * 60) return '–';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatSpeed(kmh: number | null) {
  return kmh === null || !Number.isFinite(kmh) ? '–' : kmh.toFixed(1);
}

export const paceFromSpeed = (ms: number | null) => (ms && ms > 0.2 ? 1000 / ms : null);
export const kmhFromSpeed = (ms: number | null) => (ms === null ? null : ms * 3.6);

/** Rides show speed; runs and hikes show pace (agreed). */
export const usesSpeed = (type: ActivityType) => type === 'RIDE';

export type DayPart = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export function dayPart(d: Date): DayPart {
  const h = d.getHours();
  return h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 17 ? 'Afternoon' : h >= 17 && h < 21 ? 'Evening' : 'Night';
}

/** Others never see the first and last 200 m of a route (often home). Same rule as the server. */
export const PRIVACY_M = 200;

export function trimEnds(points: LatLng[], meters = PRIVACY_M): LatLng[] {
  const cut = (pts: LatLng[]) => {
    let walked = 0;
    for (let i = 1; i < pts.length; i++) {
      walked += metersBetween(pts[i - 1]!, pts[i]!);
      if (walked >= meters) return pts.slice(i);
    }
    return [];
  };
  return cut(cut(points).reverse()).reverse();
}

export function routeLength(points: (LatLng | TrackPoint)[]) {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += metersBetween(points[i - 1]!, points[i]!);
  return m;
}

/** What others see: 200 m off each end, or 20% when the route is short. Same rule as the server. */
export function privacyTrim(points: LatLng[]): LatLng[] {
  return trimEnds(points, Math.min(PRIVACY_M, routeLength(points) * 0.2));
}

// ── Human speed limits (same numbers as server/src/modules/activities/speed.ts) ─────

export const SPEED_LIMITS: Record<ActivityType, { windowKmh: number; avgKmh: number }> = {
  RUN: { windowKmh: 36, avgKmh: 25 },
  HIKE: { windowKmh: 20, avgKmh: 16 },
  RIDE: { windowKmh: 80, avgKmh: 60 },
};
export const WINDOW_SEC = 30;

/** Speed (km/h) over the last 30 s of the segment; null until at least 15 s are recorded. */
export function windowKmh(segment: TrackPoint[]): number | null {
  if (segment.length < 2) return null;
  const last = segment[segment.length - 1]!;
  let meters = 0;
  let i = segment.length - 1;
  while (i > 0 && last[2] - segment[i - 1]![2] <= WINDOW_SEC * 1000) {
    meters += metersBetween(segment[i - 1]!, segment[i]!);
    i--;
  }
  const secs = (last[2] - segment[i]![2]) / 1000;
  return secs >= 15 ? (meters / secs) * 3.6 : null;
}

/** km/h between two fixes: used to drop GPS "teleports" (a single wild point). */
export const stepKmh = (a: TrackPoint, b: TrackPoint) =>
  b[2] > a[2] ? (metersBetween(a, b) / ((b[2] - a[2]) / 1000)) * 3.6 : Infinity;

/** The owner's full route split into the hidden start, what others see, and the hidden end. */
export function splitPrivate(route: LatLng[]): { head: LatLng[]; visible: LatLng[]; tail: LatLng[] } {
  const visible = privacyTrim(route);
  if (visible.length < 2) return { head: route, visible: [], tail: [] };
  // trimEnds slices, so the visible part is the same objects as a stretch of the route.
  const from = route.indexOf(visible[0]!);
  const to = route.lastIndexOf(visible[visible.length - 1]!);
  return { head: route.slice(0, from + 1), visible, tail: route.slice(to) };
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const PACE_STOPS = ['#9A3412', '#F97316', '#FFD08A'].map(hex);

/**
 * One colour per point for the live route: deep orange where you were slow, light where you were fast.
 * Speeds are smoothed over a few fixes and scaled between this route's own slow and fast parts.
 */
export function paceColors(points: TrackPoint[], segmentStarts: number[] = []): string[] {
  const n = points.length;
  if (n < 3) return points.map(() => '#F97316');
  const starts = new Set(segmentStarts);
  const step = points.map((p, i) => (i === 0 || starts.has(i) ? null : Math.min(stepKmh(points[i - 1]!, p), 120)));
  const smooth = step.map((_, i) => {
    let sum = 0;
    let c = 0;
    for (let j = Math.max(1, i - 3); j <= Math.min(n - 1, i + 3); j++) {
      const v = step[j];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        sum += v;
        c++;
      }
    }
    return c ? sum / c : null;
  });
  const sorted = smooth.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!sorted.length) return points.map(() => '#F97316');
  const lo = sorted[Math.floor(sorted.length * 0.1)]!;
  const hi = sorted[Math.floor(sorted.length * 0.9)]!;
  return smooth.map((v) => {
    const f = v === null || hi - lo < 0.5 ? 0.5 : Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    const [a, b, k] = f < 0.5 ? [PACE_STOPS[0]!, PACE_STOPS[1]!, f * 2] : [PACE_STOPS[1]!, PACE_STOPS[2]!, (f - 0.5) * 2];
    return '#' + a.map((x, i) => Math.round(x + (b[i]! - x) * k).toString(16).padStart(2, '0')).join('');
  });
}
