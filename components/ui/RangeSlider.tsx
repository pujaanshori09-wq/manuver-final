import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { makeStyles } from '@/lib/theme';
import { GlossFill } from './Gloss';

const THUMB = 30;

/**
 * Two-thumb range slider (age range). Values are integers between min and max.
 * Uses refs so drags always read the latest value (no stale closures).
 */
export function RangeSlider({
  min,
  max,
  value,
  onChange,
  accessibilityLabel,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  accessibilityLabel?: string;
}) {
  const s = useStyles();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const startX = useRef(0);

  const toX = (v: number) => ((v - min) / (max - min)) * widthRef.current;
  const toV = (x: number) => Math.round(min + (Math.max(0, Math.min(widthRef.current, x)) / widthRef.current) * (max - min));

  const makePan = (which: 0 | 1) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startX.current = toX(valueRef.current[which]);
      },
      onPanResponderMove: (_, g) => {
        const [lo, hi] = valueRef.current;
        const v = toV(startX.current + g.dx);
        if (which === 0 && v < hi && v !== lo) {
          Haptics.selectionAsync().catch(() => {});
          onChangeRef.current([v, hi]);
        }
        if (which === 1 && v > lo && v !== hi) {
          Haptics.selectionAsync().catch(() => {});
          onChangeRef.current([lo, v]);
        }
      },
    });

  const panLo = useRef(makePan(0)).current;
  const panHi = useRef(makePan(1)).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const step = (which: 0 | 1, delta: number) => {
    const [lo, hi] = valueRef.current;
    if (which === 0) onChange([Math.max(min, Math.min(hi - 1, lo + delta)), hi]);
    else onChange([lo, Math.min(max, Math.max(lo + 1, hi + delta))]);
  };

  const loX = width ? ((value[0] - min) / (max - min)) * width : 0;
  const hiX = width ? ((value[1] - min) / (max - min)) * width : 0;

  return (
    <View style={s.wrap} onLayout={onLayout}>
      <View style={s.track} />
      <View style={[s.active, { left: loX, width: Math.max(0, hiX - loX) }]}>
        <GlossFill highlight={false} />
      </View>
      {([0, 1] as const).map((which) => (
        <View
          key={which}
          {...(which === 0 ? panLo : panHi).panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${accessibilityLabel ?? ''} ${which === 0 ? 'min' : 'max'}`.trim()}
          accessibilityValue={{ min, max, now: value[which] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => step(which, e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          hitSlop={12}
          style={[s.thumb, { left: (which === 0 ? loX : hiX) - THUMB / 2 }]}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: { height: THUMB + 8, justifyContent: 'center', marginHorizontal: THUMB / 2 },
    track: { height: 4, borderRadius: 2, backgroundColor: t.surfaceMuted },
    active: { position: 'absolute', height: 4, borderRadius: 2, overflow: 'hidden' },
    thumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.12)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
    },
  }),
);
