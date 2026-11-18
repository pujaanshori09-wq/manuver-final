import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Discover filters. Age, distance and visibility live on the server profile
 * (PATCH /me/profile); the sport filter is a per-device choice kept here.
 */
export const FILTERS_STORAGE_KEY = '@manuver_match_filters_v1';

/** Sport ids match the onboarding list, which is what the server stores. */
export const FILTER_SPORTS: { id: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'badminton', icon: 'tennisball-outline' },
  { id: 'lari', icon: 'walk-outline' },
  { id: 'gym', icon: 'barbell-outline' },
  { id: 'futsal', icon: 'football-outline' },
  { id: 'basket', icon: 'basketball-outline' },
  { id: 'tenis', icon: 'tennisball-outline' },
  { id: 'padel', icon: 'tennisball-outline' },
  { id: 'yoga', icon: 'body-outline' },
  { id: 'sepeda', icon: 'bicycle-outline' },
  { id: 'renang', icon: 'water-outline' },
  { id: 'boxing', icon: 'fitness-outline' },
  { id: 'voli', icon: 'basketball-outline' },
  { id: 'calisthenics', icon: 'barbell-outline' },
];

export const ALL_FILTER_SPORT_IDS = FILTER_SPORTS.map((s) => s.id);

/** Ids saved by older app versions, before the filter used the onboarding ids. */
const LEGACY_IDS: Record<string, string> = {
  running: 'lari',
  tennis: 'tenis',
  cycling: 'sepeda',
  swimming: 'renang',
  volleyball: 'voli',
};

export function normalizeSportIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const known = new Set(ALL_FILTER_SPORT_IDS);
  return [...new Set(ids.map((id) => LEGACY_IDS[String(id)] ?? String(id)))].filter((id) => known.has(id));
}

/** Selected sports; every sport (no narrowing) when nothing usable was saved. */
export async function loadSportFilter(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
    const ids = raw ? normalizeSportIds(JSON.parse(raw)?.selectedSports) : [];
    return ids.length ? ids : ALL_FILTER_SPORT_IDS;
  } catch {
    return ALL_FILTER_SPORT_IDS;
  }
}

export async function saveSportFilter(ids: string[]) {
  await AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ selectedSports: normalizeSportIds(ids) }));
}

/** What to send to GET /discover: nothing when every sport is selected, so custom sports still show. */
export function sportsQuery(selected: string[]): string[] | undefined {
  return selected.length === 0 || selected.length >= ALL_FILTER_SPORT_IDS.length ? undefined : selected;
}
