import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { splitPrivate, type LatLng } from '@/lib/activity';
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
  /** One colour per point (pace-coloured live route). */
  colors?: string[];
  /** Owner view: draw the start and end that others never see in grey. */
  hiddenEnds?: boolean;
};

const HIDDEN = '#9CA3AF';

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

const coords = (pts: LatLng[]) => pts.map(([latitude, longitude]) => ({ latitude, longitude }));

/** Route on a map: Google Maps on Android, Apple Maps on iOS. */
export function RouteMap({ route, style, interactive = false, follow = false, inset, colors, hiddenEnds }: Props) {
  const t = useTheme();
  const region = regionFor(route, follow);
  const parts = hiddenEnds && route.length > 1 ? splitPrivate(route) : null;
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
      {parts ? (
        <>
          {[parts.head, parts.tail].map((p, i) =>
            p.length > 1 ? (
              <Polyline key={i} coordinates={coords(p)} strokeColor={HIDDEN} strokeWidth={4} lineDashPattern={[6, 6]} />
            ) : null,
          )}
          {parts.visible.length > 1 && <Polyline coordinates={coords(parts.visible)} strokeColor={t.primary} strokeWidth={4} />}
        </>
      ) : (
        route.length > 1 && (
          <Polyline
            coordinates={coords(route)}
            strokeColor={t.primary}
            strokeColors={colors && colors.length === route.length ? colors : undefined}
            strokeWidth={follow ? 6 : 4}
          />
        )
      )}
      {/* Start (green) and finish (orange) dots, like Strava. Hidden while recording: the blue dot is you. */}
      {route.length > 1 && !follow &&
        [
          { p: route[0]!, color: '#22C55E', key: 'start' },
          { p: route[route.length - 1]!, color: t.primary, key: 'end' },
        ].map(({ p, color, key }) => (
          <Marker key={key} coordinate={{ latitude: p[0], longitude: p[1] }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 2.5, borderColor: '#FFFFFF' }} />
          </Marker>
        ))}
    </MapView>
  );
}
