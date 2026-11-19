import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatPace, formatSpeed } from '@/lib/activity';
import { fonts, useTheme } from '@/lib/theme';

const H = 150;
const LEFT = 44; // room for the axis labels
const BOTTOM = 20;

/**
 * Speed (rides) or pace (runs, hikes) along the route as a soft area chart, with the average
 * as a dashed line. Faster is always higher, so a strong finish looks like one.
 */
export function SpeedChart({
  points,
  avgKmh,
  pace,
  kmLabel,
}: {
  points: [number, number][];
  avgKmh: number;
  pace: boolean;
  kmLabel: string;
}) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const total = points[points.length - 1]![0];
  const maxV = Math.max(...points.map((p) => p[1]), avgKmh) * 1.1;
  const minV = Math.max(0, Math.min(...points.map((p) => p[1])) * 0.8);
  const plotW = Math.max(0, w - LEFT);
  const plotH = H - BOTTOM;
  const x = (m: number) => LEFT + (m / total) * plotW;
  const y = (v: number) => plotH - ((v - minV) / Math.max(0.1, maxV - minV)) * (plotH - 8);

  // Step-free line through the middle of each stretch.
  const mids = [
    [0, points[0]![1]] as const,
    ...points.map((p, i) => [((i ? points[i - 1]![0] : 0) + p[0]) / 2, p[1]] as const),
    [total, points[points.length - 1]![1]] as const,
  ];
  const line = mids.map(([m, v], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(mids[mids.length - 1]![0]).toFixed(1)},${plotH} L${x(mids[0]![0]).toFixed(1)},${plotH} Z`;

  const grid = [0.25, 0.6, 0.95].map((f) => minV + (maxV - minV) * f);
  const label = (v: number) => (pace ? formatPace(3600 / v) : formatSpeed(v));
  const kmStep = total > 8000 ? 5000 : total > 3000 ? 1000 : total > 1200 ? 500 : 250;
  const ticks: number[] = [];
  for (let m = kmStep; m < total * 0.97; m += kmStep) ticks.push(m);

  return (
    <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.primary} stopOpacity={0.45} />
              <Stop offset="1" stopColor={t.primary} stopOpacity={0.04} />
            </LinearGradient>
          </Defs>
          {grid.map((v) => (
            <Line key={v} x1={LEFT} x2={w} y1={y(v)} y2={y(v)} stroke={t.hairline} strokeWidth={1} />
          ))}
          <Path d={area} fill="url(#fill)" />
          <Path d={line} stroke={t.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />
          <Line x1={LEFT} x2={w} y1={y(avgKmh)} y2={y(avgKmh)} stroke={t.text} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 4" />
        </Svg>
      )}
      {w > 0 &&
        grid.map((v) => (
          <Text key={v} style={[s.axis, { color: t.textMuted, top: y(v) - 8, left: 0, width: LEFT - 6, textAlign: 'right' }]}>
            {label(v)}
          </Text>
        ))}
      {w > 0 &&
        ticks.map((m) => (
          <Text key={m} style={[s.axis, { color: t.textMuted, top: plotH + 4, left: x(m) - 24, width: 48, textAlign: 'center' }]}>
            {`${Math.round((m / 1000) * 10) / 10} ${kmLabel}`}
          </Text>
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  axis: { position: 'absolute', fontFamily: fonts.body, fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] },
});
