import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme, makeStyles, type Theme, fonts, space } from '@/lib/theme';
import { useT } from '@/lib/i18n';
const SPORT_TAG_MAP: Record<string, { name: string, icon: any }> = {
  badminton: { name: 'Badminton', icon: 'tennisball-outline' },
  lari: { name: 'Lari', icon: 'walk-outline' },
  gym: { name: 'Gym', icon: 'barbell-outline' },
  sepeda: { name: 'Sepeda', icon: 'bicycle-outline' },
  basket: { name: 'Basket', icon: 'basketball-outline' },
  futsal: { name: 'Futsal', icon: 'football-outline' },
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AjakMainSheetProps {
  visible: boolean;
  onClose: () => void;
  onSend: (inviteData: any) => void;
  partnerName: string;
}

export default function AjakMainSheet({ visible, onClose, onSend, partnerName }: AjakMainSheetProps) {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const [selectedSport, setSelectedSport] = useState<string>('badminton');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [note, setNote] = useState('');

  const sports = Object.entries(SPORT_TAG_MAP);

  const handleSend = () => {
    if (!venue.trim()) {
      alert('Lokasi latihan harus diisi.');
      return;
    }

    onSend({
      sport: selectedSport,
      venue_name: venue.trim(),
      scheduled_at: date.toISOString(),
      note: note.trim() || null,
    });
    
    // Reset state after sending
    setVenue('');
    setNote('');
    onClose();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const currentDate = new Date(date);
      currentDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDate(currentDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const currentDate = new Date(date);
      currentDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(currentDate);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetContainer}
            >
              <View style={styles.sheetContent}>
                {/* Drag Handle */}
                <View style={styles.dragHandle} />

                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>{tr('sheets.ajakTitle')} {partnerName}</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('common.close')} onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={t.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.formContainer}>
                  
                  {/* Sport Picker */}
                  <Text style={styles.label}>{tr('sheets.pickSport')}</Text>
                  <View style={styles.sportsGrid}>
                    {sports.map(([id, sport]) => (
                      <TouchableOpacity accessibilityRole="button"
                        key={id}
                        style={[styles.sportPill, selectedSport === id && styles.sportPillActive]}
                        onPress={() => setSelectedSport(id)}
                      >
                        <Ionicons 
                          name={sport.icon as any} 
                          size={16} 
                          color={selectedSport === id ? '#FFFFFF' : t.textSecondary} 
                        />
                        <Text style={[styles.sportPillText, selectedSport === id && styles.sportPillTextActive]}>
                          {sport.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Venue Input */}
                  <Text style={styles.label}>{tr('sheets.venue')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={tr('sheets.venuePhGbk')}
                    placeholderTextColor={t.textMuted}
                    value={venue}
                    onChangeText={setVenue}
                  />

                  {/* Date & Time Picker */}
                  <View style={styles.dateTimeRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>{tr('sheets.date')}</Text>
                      <TouchableOpacity accessibilityRole="button" 
                        style={styles.datePickerBtn}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Ionicons name="calendar-outline" size={20} color={t.primary} />
                        <Text style={styles.datePickerText}>
                          {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.flex1}>
                      <Text style={styles.label}>{tr('sheets.time')}</Text>
                      <TouchableOpacity accessibilityRole="button" 
                        style={styles.datePickerBtn}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={20} color={t.primary} />
                        <Text style={styles.datePickerText}>
                          {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {(showDatePicker || showTimePicker) && (
                    <DateTimePicker
                      value={date}
                      mode={showDatePicker ? "date" : "time"}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={showDatePicker ? handleDateChange : handleTimeChange}
                      themeVariant="dark"
                      minimumDate={new Date()}
                    />
                  )}

                  {/* Note */}
                  <Text style={styles.label}>{tr('sheets.noteOptional')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder={tr('sheets.notePhShuttle')}
                    placeholderTextColor={t.textMuted}
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />

                  {/* Submit */}
                  <TouchableOpacity accessibilityRole="button" 
                    style={[styles.submitBtn, !venue.trim() && styles.submitBtnDisabled]}
                    onPress={handleSend}
                    disabled={!venue.trim()}
                  >
                    <Text style={styles.submitBtnText}>{tr('sheets.sendInvite')}</Text>
                    <Ionicons name="paper-plane" size={18} color={'#FFFFFF'} />
                  </TouchableOpacity>

                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: t.scrim,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  sheetContent: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.border,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: t.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: t.text,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: t.hairline,
    borderRadius: 20,
  },
  formContainer: {
    gap: 16,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: t.textSecondary,
    marginBottom: -8,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: t.hairline,
    borderWidth: 1,
    borderColor: t.hairline,
  },
  sportPillActive: {
    backgroundColor: t.primarySoft,
    borderColor: t.primary,
  },
  sportPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: t.textSecondary,
  },
  sportPillTextActive: {
    color: '#FFFFFF',
    fontFamily: fonts.displaySemi,
  },
  input: {
    backgroundColor: t.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    color: t.text,
    borderWidth: 1,
    borderColor: t.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  flex1: {
    flex: 1,
    gap: 16,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: t.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: t.border,
  },
  datePickerText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: t.text,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
    elevation: 4,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: '#FFFFFF',
  },
}));
