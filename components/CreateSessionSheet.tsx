import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sessionsApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';
import { useT, type TKey } from '@/lib/i18n';
interface CreateSessionSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const SPORTS_OPTIONS = [
  { id: 'badminton', name: 'Badminton', icon: 'tennisball-outline' as const },
  { id: 'running', name: 'Running', icon: 'walk-outline' as const },
  { id: 'gym', name: 'Gym', icon: 'barbell-outline' as const },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball-outline' as const },
  { id: 'futsal', name: 'Futsal', icon: 'football-outline' as const },
  { id: 'basket', name: 'Basket', icon: 'basketball-outline' as const },
];

const GENDER_OPTIONS: { id: 'any' | 'male' | 'female'; label: string }[] = [
  { id: 'any', label: 'sheets.genderAny' },
  { id: 'male', label: 'sheets.genderMale' },
  { id: 'female', label: 'sheets.genderFemale' },
];

export default function CreateSessionSheet({
  visible,
  onClose,
  onCreated,
}: CreateSessionSheetProps) {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const [sport, setSport] = useState<string>('badminton');
  const [title, setTitle] = useState<string>('');
  const [venue, setVenue] = useState<string>('');
  const [hoursAhead, setHoursAhead] = useState<number>(24); // default 24h from now
  const [slots, setSlots] = useState<number>(4);
  const [genderPref, setGenderPref] = useState<'any' | 'male' | 'female'>('any');
  const [skillNote, setSkillNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleIncrement = () => {
    if (slots < 10) setSlots((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (slots > 2) setSlots((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(tr('sheets.heads'), tr('sheets.titleRequired'));
      return;
    }
    if (!venue.trim()) {
      Alert.alert(tr('sheets.heads'), tr('sheets.venueRequired2'));
      return;
    }

    setLoading(true);

    try {
      // Calculate scheduled ISO timestamp (UTC)
      const scheduledTime = new Date(Date.now() + hoursAhead * 3600 * 1000).toISOString();

      // The server adds the host as the first player.
      await sessionsApi.create({
        sport,
        title: title.trim(),
        venueName: venue.trim(),
        scheduledAt: scheduledTime,
        slotsTotal: slots,
        genderPref: genderPref === 'male' ? 'MEN' : genderPref === 'female' ? 'WOMEN' : 'ALL',
        skillNote: skillNote.trim() || null,
      });

      Alert.alert(tr('sheets.sessionCreated'), tr('sheets.sessionCreatedBody'));

      // Reset fields
      setTitle('');
      setVenue('');
      setSkillNote('');
      setSlots(4);
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating session:', err);
      Alert.alert(tr('sheets.sessionFailed'), apiErrorMessage(err, tr));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity accessibilityRole="button"
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{tr('sheets.openSession')}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('common.close')}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={t.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* 1. Sport Selection */}
            <Text style={styles.fieldLabel}>{tr('sheets.pickSport')}</Text>
            <View style={styles.sportsGrid}>
              {SPORTS_OPTIONS.map((item) => {
                const active = sport === item.id;
                return (
                  <TouchableOpacity accessibilityRole="button"
                    key={item.id}
                    style={[styles.sportPill, active && styles.sportPillActive]}
                    onPress={() => setSport(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={15}
                      color={active ? t.primary : t.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sportPillText,
                        active && styles.sportPillTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Title */}
            <Text style={styles.fieldLabel}>{tr('sheets.sessionTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={tr('sheets.sessionTitlePh')}
              placeholderTextColor={t.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            {/* 3. Venue */}
            <Text style={styles.fieldLabel}>{tr('sheets.venueLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={tr('sheets.venuePhGbkCourt')}
              placeholderTextColor={t.textMuted}
              value={venue}
              onChangeText={setVenue}
            />

            {/* 4. Quick Time Slot Preset */}
            <Text style={styles.fieldLabel}>{tr('sheets.schedule')}</Text>
            <View style={styles.timePresetsRow}>
              {[
                { label: tr('sheets.tonight'), hours: 5 },
                { label: tr('sheets.tomorrowMorning'), hours: 16 },
                { label: tr('sheets.tomorrowEvening'), hours: 24 },
                { label: tr('sheets.weekend'), hours: 72 },
              ].map((slot) => {
                const active = hoursAhead === slot.hours;
                return (
                  <TouchableOpacity accessibilityRole="button"
                    key={slot.hours}
                    style={[styles.timePresetChip, active && styles.timePresetChipActive]}
                    onPress={() => setHoursAhead(slot.hours)}
                  >
                    <Text
                      style={[
                        styles.timePresetText,
                        active && styles.timePresetTextActive,
                      ]}
                    >
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 5. Slots Stepper */}
            <View style={styles.stepperContainer}>
              <View>
                <Text style={styles.fieldLabelNoMargin}>{tr('sheets.totalSlots')}</Text>
                <Text style={styles.stepperSub}>{tr('sheets.slotsHint')}</Text>
              </View>

              <View style={styles.stepperControls}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('a11y.decrease')}
                  style={[styles.stepperBtn, slots <= 2 && styles.stepperBtnDisabled]}
                  onPress={handleDecrement}
                  disabled={slots <= 2}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={slots <= 2 ? t.border : '#FFFFFF'}
                  />
                </TouchableOpacity>

                <Text style={styles.stepperValue}>{slots}</Text>

                <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('a11y.increase')}
                  style={[styles.stepperBtn, slots >= 10 && styles.stepperBtnDisabled]}
                  onPress={handleIncrement}
                  disabled={slots >= 10}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={slots >= 10 ? t.border : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 6. Gender Toggle */}
            <Text style={styles.fieldLabel}>{tr('sheets.gender')}</Text>
            <View style={styles.genderToggleRow}>
              {GENDER_OPTIONS.map((g) => {
                const active = genderPref === g.id;
                return (
                  <TouchableOpacity accessibilityRole="button"
                    key={g.id}
                    style={[styles.genderSegment, active && styles.genderSegmentActive]}
                    onPress={() => setGenderPref(g.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.genderSegmentText,
                        active && styles.genderSegmentTextActive,
                      ]}
                    >
                      {tr(g.label as TKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 7. Skill Note */}
            <Text style={styles.fieldLabel}>{tr('sheets.skillNote')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={tr('sheets.skillNotePh')}
              placeholderTextColor={t.textMuted}
              multiline
              numberOfLines={2}
              value={skillNote}
              onChangeText={setSkillNote}
            />

            {/* Submit */}
            <TouchableOpacity accessibilityRole="button"
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{tr('sheets.publish')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: t.scrim,
  },
  sheetContainer: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: t.hairline,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: t.text,
  },
  scrollBody: {
    paddingBottom: 20,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: t.textSecondary,
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
  },
  fieldLabelNoMargin: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: t.textSecondary,
    letterSpacing: 0.8,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    color: t.primary,
  },
  input: {
    backgroundColor: t.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: t.text,
    fontFamily: fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: t.hairline,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  timePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timePresetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.hairline,
  },
  timePresetChipActive: {
    backgroundColor: t.primarySoft,
    borderColor: t.primary,
  },
  timePresetText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: t.textSecondary,
  },
  timePresetTextActive: {
    color: t.primary,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: t.bg,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: t.hairline,
  },
  stepperSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: t.textMuted,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    backgroundColor: t.surfaceMuted,
  },
  stepperValue: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: t.text,
    minWidth: 20,
    textAlign: 'center',
  },
  genderToggleRow: {
    flexDirection: 'row',
    backgroundColor: t.bg,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: t.hairline,
    gap: 4,
  },
  genderSegment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  genderSegmentActive: {
    backgroundColor: t.primarySoft,
    borderWidth: 1,
    borderColor: t.primary,
  },
  genderSegmentText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: t.textSecondary,
  },
  genderSegmentTextActive: {
    color: t.primary,
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
}));
