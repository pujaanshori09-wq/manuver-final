import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField } from '@/components/DateTimeField';
import { eventsApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';

import { useTheme, makeStyles, type Theme, fonts } from '@/lib/theme';


import { useT } from '@/lib/i18n';
type Mode = 'USER' | 'COMPS';

const TABS: { key: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'USER', label: 'USER', icon: 'people-outline' },
  { key: 'COMPS', label: 'COMPS', icon: 'trophy-outline' },
];

const SPORTS = ['Padel', 'Tennis', 'Badminton', 'Futsal', 'Basket', 'Running', 'Lainnya'];
const USER_TYPES = ['Social', 'Americano', 'Doubles', 'Class'];
const COMP_FORMATS = ['Knockout', 'Round Robin', 'Liga'];

const IMAGES: Record<Mode, string> = {
  USER: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=80',
  COMPS: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80',
};

export default function CreateEventScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('USER');
  const [loading, setLoading] = useState(false);

  // Shared fields
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [sport, setSport] = useState('');
  const [quota, setQuota] = useState('');
  const [price, setPrice] = useState('');

  // Mode-specific
  const [userType, setUserType] = useState('Social');
  const [compFormat, setCompFormat] = useState('Knockout');

  const isComps = mode === 'COMPS';

  const handleSubmit = async () => {
    if (!title || !date || !location || !city || !sport || (isComps && !organizer)) {
      Alert.alert(tr('createEvent.incompleteTitle'), tr('createEvent.incompleteBody'));
      return;
    }

    try {
      setLoading(true);
      // New events wait for review before others can see them.
      await eventsApi.create({
        title: title.trim(),
        organizer: organizer.trim() || tr('createEvent.host'),
        startsAt: date.toISOString(),
        location: location.trim(),
        city: city.trim(),
        category: sport,
        type: isComps ? `Kompetisi · ${compFormat}` : `Komunitas · ${userType}`,
        quota: quota ? parseInt(quota.replace(/[^0-9]/g, ''), 10) || null : null,
        imageUrl: IMAGES[mode],
        priceIdr: price ? parseInt(price.replace(/[^0-9]/g, ''), 10) || 0 : 0,
      });
      Alert.alert(
        isComps ? tr('createEvent.compCreated') : tr('createEvent.meetCreated'),
        tr('createEvent.createdBody'),
        [{ text: tr('common.ok'), onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert(tr('createEvent.error'), apiErrorMessage(e, tr));
    } finally {
      setLoading(false);
    }
  };

  const renderChips = (options: string[], value: string, onChange: (v: string) => void) => (
    <View style={styles.chipsRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity accessibilityRole="button"
            key={opt}
            id={`chip-${opt.toLowerCase().replace(/\s/g, '-')}`}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    icon: keyof typeof Ionicons.glyphMap,
    keyboardType: 'default' | 'numeric' = 'default'
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={18} color={t.textSecondary} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={t.textSecondary}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ExpoStatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('common.close')} id="create-close-btn" onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={t.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tr('createEvent.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* 2 Tabs: USER / COMPS */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const active = mode === tab.key;
          return (
            <TouchableOpacity accessibilityRole="button"
              key={tab.key}
              id={`tab-${tab.key.toLowerCase()}`}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setMode(tab.key)}
            >
              <Ionicons name={tab.icon} size={16} color={active ? t.primary : t.textSecondary} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.key === 'USER' ? tr('createEvent.tabMeet') : tr('createEvent.tabComp')}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Info banner */}
      <View style={styles.banner}>
        <MaterialCommunityIcons
          name={isComps ? 'trophy-variant' : 'account-group'}
          size={22}
          color={t.primary}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{isComps ? tr('createEvent.createComp') : tr('createEvent.createMeetTitle')}</Text>
          <Text style={styles.bannerSub}>
            {isComps
              ? tr('createEvent.compSub')
              : tr('createEvent.meetSub')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderInput(
            isComps ? tr('createEvent.compName') : tr('createEvent.meetName'),
            title,
            setTitle,
            isComps ? tr('createEvent.compNamePh') : tr('createEvent.meetNamePh'),
            'create-outline'
          )}

          <Text style={styles.label}>{tr('createEvent.sport')}</Text>
          {renderChips(SPORTS, sport, setSport)}

          <Text style={styles.label}>{isComps ? tr('createEvent.format') : tr('createEvent.meetType')}</Text>
          {isComps
            ? renderChips(COMP_FORMATS, compFormat, setCompFormat)
            : renderChips(USER_TYPES, userType, setUserType)}

          {renderInput(
            isComps ? tr('createEvent.organizer') : tr('createEvent.host'),
            organizer,
            setOrganizer,
            isComps ? tr('createEvent.organizerPh') : tr('createEvent.hostPh'),
            'person-outline'
          )}

          <DateTimeField label={tr('createEvent.date')} placeholder={tr('createEvent.datePh')} value={date} onChange={setDate} />
          {renderInput(tr('createEvent.venue'), location, setLocation, tr('createEvent.venuePh'), 'location-outline')}
          {renderInput(tr('createEvent.city'), city, setCity, tr('createEvent.cityPh'), 'business-outline')}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              {renderInput(
                isComps ? tr('createEvent.teamQuota') : tr('createEvent.playerQuota'),
                quota,
                setQuota,
                isComps ? '16' : '8',
                'people-outline',
                'numeric'
              )}
            </View>
            <View style={{ flex: 1 }}>
              {renderInput(
                isComps ? tr('createEvent.entryFee') : tr('createEvent.feePerPerson'),
                price,
                setPrice,
                tr('createEvent.feePh'),
                'cash-outline',
                'numeric'
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky submit */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity accessibilityRole="button"
          id="create-submit-btn"
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name={isComps ? 'trophy' : 'add-circle'} size={20} color="#fff" />
              <Text style={styles.submitBtnText}>{isComps ? tr('createEvent.createComp') : tr('createEvent.createMeet')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: { padding: 4 },
  headerTitle: { color: t.text, fontSize: 20, fontFamily: 'Poppins_600SemiBold' },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: t.primary },
  tabText: { color: t.textSecondary, fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6 },
  tabTextActive: { color: t.primary },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: t.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  bannerTitle: { color: t.text, fontFamily: fonts.bodyBold, fontSize: 15 },
  bannerSub: { color: t.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  content: { padding: 16 },
  field: { marginBottom: 18 },
  label: { color: t.textSecondary, fontFamily: fonts.bodyBold, fontSize: 12, marginBottom: 8, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: t.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 13 },
  row: { flexDirection: 'row', gap: 12 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  chipActive: { backgroundColor: t.primary, borderColor: t.primary },
  chipText: { color: t.textSecondary, fontFamily: fonts.bodyBold, fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 15,
    borderRadius: 999,
  },
  submitBtnText: { color: '#fff', fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
}));
