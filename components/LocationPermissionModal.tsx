import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PermissionState } from '../hooks/useLocationManager';

import { useTheme, makeStyles, type Theme, fonts, space, radius } from '@/lib/theme';
import { useT } from '@/lib/i18n';
interface LocationPermissionModalProps {
  visible: boolean;
  state: PermissionState;
  loading: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  onSkip: () => void;
}

export default function LocationPermissionModal({
  visible,
  state,
  loading,
  onRequestPermission,
  onOpenSettings,
  onSkip,
}: LocationPermissionModalProps) {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  
  let title = tr('sheets.locTitle');
  let description = tr('sheets.locBody');
  let primaryAction = tr('sheets.locEnable');
  let primaryActionFunc = onRequestPermission;
  let iconName: keyof typeof Ionicons.glyphMap = 'location';

  if (state === 'BLOCKED') {
    title = tr('sheets.locBlocked');
    description = tr('sheets.locBlockedBody');
    primaryAction = tr('sheets.openSettings');
    primaryActionFunc = onOpenSettings;
    iconName = 'settings';
  } else if (state === 'SERVICES_DISABLED') {
    title = tr('sheets.gpsOff');
    description = tr('sheets.gpsOffBody');
    primaryAction = tr('sheets.openSettings');
    primaryActionFunc = onOpenSettings;
    iconName = 'navigate-circle';
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Theme scrim instead of a raw BlurView (unreliable and costly on Android). */}
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[t.gloss[0], t.gloss[2]]}
              style={styles.iconGradient}
            >
              <Ionicons name={iconName} size={32} color={'#FFFFFF'} />
            </LinearGradient>
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          
          <View style={styles.actionContainer}>
            <TouchableOpacity accessibilityRole="button"
              style={styles.primaryButton}
              onPress={primaryActionFunc}
              activeOpacity={0.8}
              disabled={loading}
            >
              <LinearGradient
                colors={[t.gloss[0], t.gloss[2]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color={'#FFFFFF'} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>{primaryAction}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={onSkip}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>{tr('sheets.later')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: t.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: space.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: t.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  buttonGradient: {
    width: '100%',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: t.textSecondary,
  },
}));
