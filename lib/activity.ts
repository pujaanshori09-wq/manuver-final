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
    if (lat === pLat && lng === pLng && out) continue; // same spot to ~1 m
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
