import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity , Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addMatchToCalendar } from '../lib/calendar';
import { scheduleMatchReminder } from '../lib/notifications';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
interface SparingInviteCardProps {
  inviteId: string;
  sport: string;
  venueName: string;
  scheduledAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'counter_proposed' | 'cancelled' | 'completed' | 'expired';
  isReceiver: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  note?: string | null;
}

export default function SparingInviteCard({
  sport,
  venueName,
  scheduledAt,
  status,
  isReceiver,
  onAccept,
  onDecline,
  note,
}: SparingInviteCardProps) {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const getSportIcon = (name: string): any => {
    const lower = name.toLowerCase();
    if (lower.includes('run') || lower.includes('lari')) return 'walk-outline';
    if (lower.includes('gym') || lower.includes('fit') || lower.includes('barbell')) return 'barbell-outline';
    if (lower.includes('cycle') || lower.includes('sepeda')) return 'bicycle-outline';
    if (lower.includes('badminton') || lower.includes('tennis')) return 'tennisball-outline';
    if (lower.includes('basket')) return 'basketball-outline';
    if (lower.includes('futsal') || lower.includes('football')) return 'football-outline';
    return 'fitness-outline';
  };
  const sportData = { name: sport, icon: getSportIcon(sport) };
  
  const dateObj = new Date(scheduledAt);
  const formattedDate = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  const formattedTime = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Determine status display
  let statusBadgeColor: string = t.primary;
  let statusText = 'Pending';
  let isExpired = false;

  if (status === 'accepted') {
    statusBadgeColor = t.success;
    statusText = 'Diterima';
  } else if (status === 'declined') {
    statusBadgeColor = t.danger;
    statusText = 'Ditolak';
  } else if (status === 'cancelled') {
    statusBadgeColor = t.textMuted;
    statusText = 'Dibatalkan';
  } else if (status === 'expired' || new Date() > new Date(new Date(scheduledAt).getTime() + 86400000)) {
    // Basic expiry check (24h after scheduled time as a fallback)
    statusBadgeColor = t.textMuted;
    statusText = 'Kedaluwarsa';
    isExpired = true;
  }

  const isPending = status === 'pending';

  return (
    <View style={[styles.cardContainer, (isExpired || status === 'declined' || status === 'cancelled') && styles.cardExpired]}>
      {/* Header: Sport & Status */}
      <View style={styles.headerRow}>
        <View style={styles.sportBadge}>
          <Ionicons name={sportData.icon as any} size={16} color={'#FFFFFF'} />
          <Text style={styles.sportName}>{sportData.name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusBadgeColor}20` }]}>
          <Text style={[styles.statusText, { color: statusBadgeColor }]}>{statusText}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <View style={styles.iconBox}>
            <Ionicons name="calendar-outline" size={16} color={t.textSecondary} />
          </View>
          <Text style={styles.detailText}>{formattedDate} • {formattedTime}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.iconBox}>
            <Ionicons name="location-outline" size={16} color={t.textSecondary} />
          </View>
          <Text style={styles.detailText}>{venueName}</Text>
        </View>
        
        {note ? (
          <View style={[styles.detailRow, styles.noteRow]}>
            <View style={styles.iconBox}>
              <Ionicons name="document-text-outline" size={16} color={t.textSecondary} />
            </View>
            <Text style={styles.noteText}>"{note}"</Text>
          </View>
        ) : null}
      </View>

      {/* Action Buttons */}
      {isPending && isReceiver && !isExpired && (
        <View style={styles.actionRow}>
          <TouchableOpacity accessibilityRole="button" style={[styles.actionBtn, styles.declineBtn]} onPress={onDecline}>
            <Text style={styles.declineText}>{tr('sheets.decline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={[styles.actionBtn, styles.acceptBtn]} onPress={onAccept}>
            <Text style={styles.acceptText}>{tr('sheets.accept')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'accepted' && (
        <View style={styles.actionRow}>
          <TouchableOpacity accessibilityRole="button" 
            style={[styles.actionBtn, styles.calendarBtn]} 
            onPress={async () => {
              const dateObj = new Date(scheduledAt);
              const endDate = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000); // +2 hours
              const title = `Sparing ${sportData.name}`;

              const calendarSuccess = await addMatchToCalendar({
                title,
                startDate: dateObj,
                endDate,
                location: venueName,
                notes: note || tr('sheets.calNote'),
              });

              if (calendarSuccess) {
                const notifSuccess = await scheduleMatchReminder(
                  tr('sheets.reminderTitle'),
                  tr('sheets.reminderBody', { sport: sportData.name, venue: venueName }),
                  dateObj
                );
                Alert.alert(
                  tr('sheets.saved'), 
                  notifSuccess ? tr('sheets.calSavedReminder') : tr('sheets.calSaved')
                );
              }
            }}
          >
            <Ionicons name="calendar" size={18} color={'#FFFFFF'} style={{ marginRight: 8 }} />
            <Text style={styles.calendarText}>{tr('sheets.addCalendar')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPending && !isReceiver && !isExpired && (
        <View style={styles.waitingFooter}>
          <ActivityIndicator size="small" color={t.primary} style={{ transform: [{ scale: 0.7 }] }} />
          <Text style={styles.waitingText}>{tr('sheets.waitingDots')}</Text>
        </View>
      )}
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  cardContainer: {
    backgroundColor: t.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
    width: 280,
    marginVertical: 4,
  },
  cardExpired: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.hairline,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: t.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sportName: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  detailsContainer: {
    padding: 12,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: t.text,
    flex: 1,
  },
  noteRow: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  noteText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: t.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: t.hairline,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    borderRightWidth: 1,
    borderRightColor: t.hairline,
  },
  acceptBtn: {
    backgroundColor: t.primarySoft,
  },
  declineText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: t.textSecondary,
  },
  acceptText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: t.primary,
  },
  calendarBtn: {
    flexDirection: 'row',
    backgroundColor: t.primary,
  },
  calendarText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: '#FFFFFF',
  },
  waitingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderTopWidth: 1,
    borderTopColor: t.hairline,
  },
  waitingText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: t.textSecondary,
  },
}));
