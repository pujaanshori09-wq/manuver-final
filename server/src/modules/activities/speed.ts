import { metersBetween, type LatLng } from '../../lib/polyline.js';

/**
 * What a human can do, per activity type (km/h), set a little above world records:
 *   run  — 400 m WR ≈ 33 km/h, 5 km WR ≈ 24 km/h
 *   hike — 20 km race-walk WR ≈ 16 km/h
 *   ride — hour record ≈ 57 km/h; descents go faster for short stretches
 * The app uses the same numbers (lib/activity.ts SPEED_LIMITS); a test keeps them in sync.
 */
export const SPEED_LIMITS = {
  RUN: { windowKmh: 36, avgKmh: 25 },
  HIKE: { windowKmh: 20, avgKmh: 16 },
  RIDE: { windowKmh: 80, avgKmh: 60 },
} as const;

/** Speeds are judged over windows at least this long, so one GPS jump cannot fail an honest run. */
export const WINDOW_SEC = 30;

export type SpeedProblem = 'impossible_speed' | 'impossible_average' | 'distance_mismatch';

/**
 * Checks a recording against the limits. `times` are seconds since the start, one per point;
 * `segmentStarts` are the indices where recording resumed (after a pause or a vehicle stretch):
 * the jump into such a point is neither distance nor speed.
 */
export function checkSpeeds(input: {
  type: keyof typeof SPEED_LIMITS;
  points: LatLng[];
  times: number[];
  segmentStarts: number[];
  distanceM: number;
  movingSec: number;
}): SpeedProblem | null {
  const { type, points, times, distanceM, movingSec } = input;
  const limit = SPEED_LIMITS[type];
  const starts = new Set(input.segmentStarts);

  if ((distanceM / movingSec) * 3.6 > limit.avgKmh) return 'impossible_average';

  // Cumulative distance along the path, not counting the jumps between segments.
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1]! + (starts.has(i) ? 0 : metersBetween(points[i - 1]!, points[i]!)));
  }
  // The claimed distance must come from the route (a little slack for rounding and filtering).
  if (distanceM > cum[cum.length - 1]! * 1.05 + 30) return 'distance_mismatch';

  // Fastest stretch of at least WINDOW_SEC inside each segment (two pointers).
  const bounds = [0, ...[...starts].filter((i) => i > 0 && i < points.length).sort((a, b) => a - b), points.length];
  for (let s = 0; s < bounds.length - 1; s++) {
    const [from, to] = [bounds[s]!, bounds[s + 1]! - 1];
    if (to <= from) continue;
    const span = times[to]! - times[from]!;
    // A segment shorter than the window is judged as a whole once it lasts 10 s.
    const window = Math.min(WINDOW_SEC, span);
    if (window < 10) continue;
    let j = from;
    for (let i = from + 1; i <= to; i++) {
      while (j < i && times[i]! - times[j + 1]! >= window) j++;
      const dt = times[i]! - times[j]!;
      if (dt >= window && ((cum[i]! - cum[j]!) / dt) * 3.6 > limit.windowKmh) return 'impossible_speed';
    }
  }
  return null;
}

/**
 * Speed along the route for the detail chart: about `buckets` evenly spaced stretches of distance,
 * each as [distance at its end (m), km/h]. Pauses and the jumps between segments count as neither
 * distance nor time. Distances only, no coordinates, so it is safe to show anyone who sees the activity.
 */
export function speedProfile(points: LatLng[], times: number[], segmentStarts: number[], buckets = 60) {
  if (points.length < 2 || times.length !== points.length) return null;
  const starts = new Set(segmentStarts);
  const dist = [0];
  const secs = [0];
  for (let i = 1; i < points.length; i++) {
    const jump = starts.has(i);
    dist.push(dist[i - 1]! + (jump ? 0 : metersBetween(points[i - 1]!, points[i]!)));
    secs.push(secs[i - 1]! + (jump ? 0 : Math.max(0, times[i]! - times[i - 1]!)));
  }
  const total = dist[dist.length - 1]!;
  if (total < 50) return null;
  // Moving seconds at a given distance (both only ever grow, so walk forward with one index).
  let k = 0;
  const timeAt = (d: number) => {
    while (k < dist.length - 2 && dist[k + 1]! < d) k++;
    const span = dist[k + 1]! - dist[k]!;
    const f = span > 0 ? Math.min(1, Math.max(0, (d - dist[k]!) / span)) : 1;
    return secs[k]! + f * (secs[k + 1]! - secs[k]!);
  };
  const step = Math.max(50, total / buckets);
  const out: [number, number][] = [];
  let prevD = 0;
  let prevT = 0;
  for (let d = step; prevD < total - 1; d += step) {
    const end = Math.min(d, total);
    const t = timeAt(end);
    const dt = t - prevT;
    if (dt > 0) out.push([Math.round(end), Math.round(((end - prevD) / dt) * 3.6 * 10) / 10]);
    prevD = end;
    prevT = t;
  }
  return out.length >= 2 ? { points: out, maxKmh: Math.max(...out.map((p) => p[1])) } : null;
}
