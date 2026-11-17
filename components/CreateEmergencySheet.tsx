import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../app/_layout';

import { useTheme, makeStyles, type Theme, fonts, space, radius } from '@/lib/theme';
import { useT } from '@/lib/i18n';
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SPORTS = ['Badminton', 'Padel', 'Futsal', 'Tennis', 'Basket', 'Running'];

export default function CreateEmergencySheet({ visible, onClose, onSuccess }: Props) {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const { session } = useAuth();
  const [sport, setSport] = useState('Badminton');
  const [venue, setVenue] = useState('');
  const [slotsNeeded, setSlotsNeeded] = useState(1);
  const [fee, setFee] = useState('');
  const [contactWa, setContactWa] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!venue.trim()) {
      Alert.alert(tr('sheets.heads'), tr('sheets.venueRequired'));
      return;
    }
    if (!contactWa.trim()) {
      Alert.alert(tr('sheets.heads'), tr('sheets.waRequired'));
      return;
    }

    setSubmitting(true);
    try {
      // Default play time: 2 hours from now
      const playTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      // Expiry: 4 hours from now
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

      const parsedFee = fee ? parseInt(fee.replace(/[^0-9]/g, ''), 10) : 0;

      const { error } = await supabase.from('emergency_slots').insert({
        creator_id: session?.user.id,
        sport,
        venue_name: venue.trim(),
        play_time: playTime.toISOString(),
        expires_at: expiresAt.toISOString(),
        slots_needed: slotsNeeded,
        fee_per_person: isNaN(parsedFee) ? 0 : parsedFee,
        contact_wa: contactWa.trim(),
        note: note.trim() || null,
        // status defaults to 'active' in the database; clients cannot set it.
      });

      if (error) throw error;

      Alert.alert(tr('sheets.sosPosted'), tr('sheets.sosPostedBody'));
      setVenue('');
      setFee('');
      setContactWa('');
      setNote('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert(tr('sheets.error'), err.message || tr('sheets.sosFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.dragBar} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{tr('sheets.sosTitle')}</Text>
              <Text style={styles.subtitle}>{tr('sheets.sosSub')}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('common.close')} onPress={onClose}>
              <Ionicons name="close" size={24} color={t.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Sport Picker */}
            <Text style={styles.label}>{tr('sheets.pickSport')}</Text>
            <View style={styles.sportGrid}>
              {SPORTS.map((s) => {
                const isSelected = sport === s;
                return (
                  <TouchableOpacity accessibilityRole="button"
                    key={s}
                    style={[styles.sportChip, isSelected && styles.sportChipActive]}
                    onPress={() => setSport(s)}
                  >
                    <Text style={[styles.sportChipText, isSelected && styles.sportChipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Venue */}
            <Text style={styles.label}>{tr('sheets.courtName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={tr('sheets.courtPh')}
              placeholderTextColor={t.textMuted}
              value={venue}
              onChangeText={setVenue}
            />

            {/* Slots & Fee */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{tr('sheets.howMany')}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('a11y.decrease')}
                    style={styles.stepperBtn}
                    onPress={() => setSlotsNeeded((prev) => Math.max(1, prev - 1))}
                  >
                    <Ionicons name="remove" size={18} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>{slotsNeeded}</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('a11y.increase')}
                    style={styles.stepperBtn}
                    onPress={() => setSlotsNeeded((prev) => Math.min(5, prev + 1))}
                  >
                    <Ionicons name="add" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.label}>{tr('sheets.split')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tr('sheets.splitPh')}
                  placeholderTextColor={t.textMuted}
                  keyboardType="numeric"
                  value={fee}
                  onChangeText={setFee}
                />
              </View>
            </View>

            {/* WhatsApp */}
            <Text style={styles.label}>{tr('sheets.waLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder="0812xxxxxxxx"
              placeholderTextColor={t.textMuted}
              keyboardType="phone-pad"
              value={contactWa}
              onChangeText={setContactWa}
            />

            {/* Note */}
            <Text style={styles.label}>{tr('sheets.shortNote')}</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              placeholder={tr('sheets.shortNotePh')}
              placeholderTextColor={t.textMuted}
              multiline
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity accessibilityRole="button"
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>{tr('sheets.broadcast')}</Text>
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
    backgroundColor: t.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: t.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: space.md,
    maxHeight: '85%',
  },
  dragBar: {
    width: 40,
    height: 4,
    backgroundColor: t.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: space.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: t.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: t.textSecondary,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    color: t.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space.sm,
  },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: t.surfaceMuted,
    borderWidth: 1,
    borderColor: t.border,
  },
  sportChipActive: {
    backgroundColor: t.primarySoft,
    borderColor: t.primary,
  },
  sportChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: t.textSecondary,
  },
  sportChipTextActive: {
    color: t.primary,
    fontFamily: fonts.display,
  },
  input: {
    backgroundColor: t.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: t.text,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: t.border,
  },
  row: {
    flexDirection: 'row',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.border,
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  stepperBtn: {
    padding: 10,
  },
  stepperVal: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: t.text,
  },
  submitBtn: {
    backgroundColor: t.danger,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: space.md,
  },
  submitBtnText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: '#FFFFFF',
  },
}));
