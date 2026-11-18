import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/activity';
import { useTheme } from '@/lib/theme';

/** react-native-maps has no web version; the web build draws just the route line. */
export function RouteMap({
  route,
  style,
  inset,
}: {
  route: LatLng[];
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  follow?: boolean;
  inset?: { top?: number; bottom?: number };
}) {
  const t = useTheme();
  if (route.length < 2) return <View style={[{ backgroundColor: t.surfaceMuted }, style]} />;

  // Equirectangular projection is plenty for a few kilometres.
  const k = Math.cos((route[0]![0] * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => -p[0]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const pad = span * 0.15;
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');

  return (
    <View style={[{ backgroundColor: t.surfaceMuted, overflow: 'hidden' }, style, { paddingTop: inset?.top ?? 0, paddingBottom: inset?.bottom ?? 0 }]}>
      <svg
        viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        <polyline
          points={points}
          fill="none"
          stroke={t.primary}
          strokeWidth={span / 60}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </View>
  );
}
