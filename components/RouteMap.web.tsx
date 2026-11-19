import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { splitPrivate, type LatLng } from '@/lib/activity';
import { useTheme } from '@/lib/theme';

const HIDDEN = '#9CA3AF';

/** react-native-maps has no web version; the web build draws just the route line. */
export function RouteMap({
  route,
  style,
  inset,
  colors,
  hiddenEnds,
}: {
  route: LatLng[];
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  follow?: boolean;
  inset?: { top?: number; bottom?: number };
  colors?: string[];
  hiddenEnds?: boolean;
}) {
  const t = useTheme();
  if (route.length < 2) return <View style={[{ backgroundColor: t.surfaceMuted }, style]} />;

  // Equirectangular projection is plenty for a few kilometres.
  const k = Math.cos((route[0]![0] * Math.PI) / 180);
  const x = (p: LatLng) => p[1] * k;
  const y = (p: LatLng) => -p[0];
  const xs = route.map(x);
  const ys = route.map(y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const pad = span * 0.15;
  const pts = (p: LatLng[]) => p.map((q) => `${x(q)},${y(q)}`).join(' ');
  const line = { fill: 'none', strokeWidth: span / 60, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
  const parts = hiddenEnds ? splitPrivate(route) : null;
  const paced = colors && colors.length === route.length;

  return (
    <View style={[{ backgroundColor: t.surfaceMuted, overflow: 'hidden' }, style, { paddingTop: inset?.top ?? 0, paddingBottom: inset?.bottom ?? 0 }]}>
      <svg
        viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        {parts ? (
          <>
            {[parts.head, parts.tail].map((p, i) =>
              p.length > 1 ? <polyline key={i} points={pts(p)} {...line} stroke={HIDDEN} strokeDasharray={`${span / 50} ${span / 50}`} /> : null,
            )}
            {parts.visible.length > 1 && <polyline points={pts(parts.visible)} {...line} stroke={t.primary} />}
          </>
        ) : paced ? (
          route.slice(1).map((p, i) => <polyline key={i} points={pts([route[i]!, p])} {...line} stroke={colors[i + 1]} />)
        ) : (
          <polyline points={pts(route)} {...line} stroke={t.primary} />
        )}
        {/* Start (green) and finish (orange), drawn over the line. */}
        {[
          { i: 0, color: '#22C55E' },
          { i: xs.length - 1, color: t.primary },
        ].map(({ i, color }) => (
          <circle key={i} cx={xs[i]} cy={ys[i]} r={span / 40} fill={color} stroke="#FFFFFF" strokeWidth={span / 120} />
        ))}
      </svg>
    </View>
  );
}
