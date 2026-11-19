import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityType, TrackPoint } from './activity';

/** The recording in progress, kept on the phone so closing the app mid-run loses nothing. */
export const DRAFT_KEY = 'manuver.activityDraft.v1';

export type Draft = {
  clientId: string;
  type: ActivityType;
  startedAt: number;
  /** Last time a point or tick was recorded; the end time if saved from a draft. */
  updatedAt: number;
  movingSec: number;
  distanceM: number;
  points: TrackPoint[];
  /** Indices in points where recording resumed (absent in drafts saved before speed checks). */
  segmentStarts?: number[];
  autoPause: boolean;
};

export async function loadDraft(): Promise<Draft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export const saveDraft = (d: Draft) => AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)).catch(() => {});
export const clearDraft = () => AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});

/** Idempotency key for an upload, not a secret, so Math.random is enough. */
export const newClientId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
