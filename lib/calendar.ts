import * as Calendar from 'expo-calendar';
import { Platform, Alert } from 'react-native';
import { translate } from '@/lib/i18n';

async function getDefaultCalendarId() {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (Platform.OS === 'ios') {
      const defaultCalendar = calendars.find(
        (cal) => cal.isPrimary || cal.title === 'Calendar' || cal.source.name === 'Default'
      );
      return defaultCalendar ? defaultCalendar.id : calendars[0].id;
    } else {
      const primaryCalendar = calendars.find(
        (cal) => cal.isPrimary && cal.accessLevel === Calendar.CalendarAccessLevel.OWNER
      );
      if (primaryCalendar) {
        return primaryCalendar.id;
      }
      return calendars.length > 0 ? calendars[0].id : null;
    }
  } catch (error) {
    console.error('Error getting calendars', error);
    return null;
  }
}

export async function addMatchToCalendar({
  title,
  startDate,
  endDate,
  location,
  notes,
}: {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  notes?: string;
}) {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        translate('calendar.deniedTitle'),
        translate('calendar.deniedBody')
      );
      return false;
    }

    const calendarId = await getDefaultCalendarId();

    if (!calendarId) {
      Alert.alert(translate('calendar.failed'), translate('calendar.noCalendar'));
      return false;
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate,
      endDate,
      location,
      notes,
      timeZone: 'Asia/Jakarta',
      alarms: [
        {
          relativeOffset: -120, // 2 hours before
          method: Calendar.AlarmMethod.ALERT,
        }
      ]
    });

    return !!eventId;
  } catch (error: any) {
    console.error('Add to calendar error:', error);
    Alert.alert(translate('calendar.failed'), translate('calendar.saveError', { msg: error.message }));
    return false;
  }
}
