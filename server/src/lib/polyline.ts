/** Google encoded polyline, precision 5 (about 1 m). Same format the app writes. */
export type LatLng = [number, number];

export function decode(str: string): LatLng[] {
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
        if (Number.isNaN(b) || b < 0) throw new Error('Invalid polyline');
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

export function encode(points: LatLng[]): string {
  let out = '';
  let pLat = 0;
  let pLng = 0;
  for (const [la, ln] of points) {
    const lat = Math.round(la * 1e5);
    const lng = Math.round(ln * 1e5);
    out += encodeValue(lat - pLat) + encodeValue(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return out;
}

export function metersBetween([lat1, lon1]: LatLng, [lat2, lon2]: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** Drops the first and last `meters` of a route so nobody else sees where it starts and ends (often home). */
export function trimEnds(points: LatLng[], meters: number): LatLng[] {
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

export function routeLength(points: LatLng[]) {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += metersBetween(points[i - 1]!, points[i]!);
  return m;
}

/** Privacy zone shown to others: 200 m at each end, or 20% of the route when it is short. */
export function privacyTrim(points: LatLng[]): LatLng[] {
  return trimEnds(points, Math.min(200, routeLength(points) * 0.2));
}
