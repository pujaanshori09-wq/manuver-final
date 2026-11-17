import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, makeStyles, type Theme, space, radius, type, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
interface SafetyReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SafetyReminderModal({ visible, onClose, onConfirm }: SafetyReminderModalProps) {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color={t.primary} />
          </View>
          
          <Text style={styles.title}>{tr('sheets.safetyTitle')}</Text>
          <Text style={styles.subtitle}>{tr('sheets.safetySub')}</Text>
          
          <View style={styles.bulletList}>
            <Text style={styles.bulletText}>{tr('sheets.safety1')}</Text>
            <Text style={styles.bulletText}>{tr('sheets.safety2')}</Text>
            <Text style={styles.bulletText}>{tr('sheets.safety3')}</Text>
            <Text style={styles.bulletText}>{tr('sheets.safety4')}</Text>
          </View>

          <TouchableOpacity accessibilityRole="button" style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.confirmButtonText}>{tr('sheets.gotIt')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: space.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 87, 47, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: {
    ...type.title,
    color: t.text,
    textAlign: 'center',
    marginBottom: space.xxs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: t.textSecondary,
    textAlign: 'center',
    marginBottom: space.md,
  },
  bulletList: {
    alignSelf: 'stretch',
    backgroundColor: t.bg,
    borderRadius: 16,
    padding: space.md,
    marginBottom: space.xxl,
  },
  bulletText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 22,
  },
  confirmButton: {
    width: '100%',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: t.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    ...type.button,
    color: '#FFFFFF',
  },
}));
