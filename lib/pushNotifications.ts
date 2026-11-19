/**
 * Push Notification Helper for Manuver
 * Uses Expo Push Notification Service for free push relay.
 * Safely guards against Expo Go limitations on Android SDK 53+.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { meApi } from './api';

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return null;
    }

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) {
      console.log('[PushNotif] Push notifications are disabled in Expo Go on Android. Use a Development Build (EAS Build) for testing remote push.');
      return null;
    }

    const Device = await import('expo-device');
    if (!Device.isDevice) {
      console.log('[PushNotif] Requires physical device for push tokens.');
      return null;
    }

    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('[PushNotif] Push notification permission denied');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF572F',
      });
    }

    return token;
  } catch (error) {
    console.log('[PushNotif] Development notice:', error);
    return null;
  }
}

/** The token this phone registered with the server, so sign-out can take it back. */
let registered: string | null = null;

/** Asks for permission once and tells the server where to send this person's pushes. */
export async function syncPushToken() {
  const token = await registerForPushNotifications();
  if (!token) return;
  try {
    await meApi.setPushToken(token);
    registered = token;
  } catch (e) {
    console.log('[PushNotif] Could not save the push token:', e);
  }
}

/** Before signing out: this phone must stop getting the old account's pushes. */
export async function forgetPushToken() {
  if (!registered) return;
  const token = registered;
  registered = null;
  await meApi.removePushToken(token).catch(() => {});
}

/** Tapping a match or message push opens that chat. Returns the unsubscribe function. */
export async function listenForPushTaps(open: (matchId: string) => void): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};
  try {
    const Notifications = await import('expo-notifications');
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as { matchId?: unknown } | undefined;
      if (typeof data?.matchId === 'string') open(data.matchId);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
