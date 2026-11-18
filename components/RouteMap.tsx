import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import MapView, { Polyline, type Region } from 'react-native-maps';
import type { LatLng } from '@/lib/activity';
import { useTheme } from '@/lib/theme';

type Props = {
  route: LatLng[];
  style?: StyleProp<ViewStyle>;
  /** Pan and zoom (detail screen). Off for cards. */
  interactive?: boolean;
  /** Keep the newest point centred and show the blue dot (recording). */
  follow?: boolean;
  /** Parts of the map covered by overlays; the route is centred in what is left. */
  inset?: { top?: number; bottom?: number };
};

function regionFor(route: LatLng[], follow: boolean): Region | undefined {
  if (!route.length) return undefined;
  if (follow) {
    const [latitude, longitude] = route[route.length - 1]!;
    return { latitude, longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 };
  }
  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.0015),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.0015),
  };
}

/** Route on a map: Google Maps on Android, Apple Maps on iOS. */
export function RouteMap({ route, style, interactive = false, follow = false, inset }: Props) {
  const t = useTheme();
  const region = regionFor(route, follow);
  return (
    <MapView
      style={style}
      // A controlled region would snap back after every pan, so only the static/following maps use it.
      {...(interactive ? { initialRegion: region } : { region })}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      liteMode={!interactive && !follow}
      showsUserLocation={follow}
      toolbarEnabled={false}
      userInterfaceStyle={t.scheme}
      mapPadding={{ top: inset?.top ?? 0, bottom: inset?.bottom ?? 0, left: 0, right: 0 }}
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      {route.length > 1 && (
        <Polyline
          coordinates={route.map(([latitude, longitude]) => ({ latitude, longitude }))}
          strokeColor={t.primary}
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}
