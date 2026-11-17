import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  PanResponder,
  ActivityIndicator,
  type ViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// If you have your supabase client configured at lib/supabase.ts:
import { supabase } from '../../lib/supabase';

import { Toggle } from '@/components/ui';
import { useTheme, makeStyles, type Theme } from '@/lib/theme';
import { useT } from '@/lib/i18n';
const STORAGE_KEY = '@manuver_match_filters_v1';

const AVAILABLE_SPORTS = [
  { id: 'badminton', name: 'Badminton', icon: 'tennisball-outline' as const },
  { id: 'running', name: 'Running', icon: 'walk-outline' as const },
  { id: 'gym', name: 'Gym & Fitness', icon: 'barbell-outline' as const },
  { id: 'futsal', name: 'Futsal', icon: 'football-outline' as const },
  { id: 'basket', name: 'Basket', icon: 'basketball-outline' as const },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball-outline' as const },
  { id: 'yoga', name: 'Yoga', icon: 'body-outline' as const },
  { id: 'cycling', name: 'Cycling', icon: 'bicycle-outline' as const },
  { id: 'swimming', name: 'Renang', icon: 'water-outline' as const },
  { id: 'boxing', name: 'Boxing', icon: 'fitness-outline' as const },
  { id: 'volleyball', name: 'Voli', icon: 'american-football-outline' as const },
  { id: 'calisthenics', name: 'Calisthenics', icon: 'pulse-outline' as const },
];

const DISTANCE_PRESETS = [5, 15, 30, 50, 100];

export interface MatchFilterSettings {
  maxDistance: number;
  strictDistance: boolean;
  minAge: number;
  maxAge: number;
  strictAge: boolean;
  selectedSports: string[];
  showMyProfile: boolean;
}

const DEFAULT_FILTERS: MatchFilterSettings = {
  maxDistance: 25,
  strictDistance: true,
  minAge: 20,
  maxAge: 32,
  strictAge: false,
  selectedSports: ['badminton', 'running', 'gym', 'tennis'],
  showMyProfile: true,
};

export default function MatchFiltersScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Settings State
  const [maxDistance, setMaxDistance] = useState<number>(DEFAULT_FILTERS.maxDistance);
  const [strictDistance, setStrictDistance] = useState<boolean>(DEFAULT_FILTERS.strictDistance);

  const [minAge, setMinAge] = useState<string>(String(DEFAULT_FILTERS.minAge));
  const [maxAge, setMaxAge] = useState<string>(String(DEFAULT_FILTERS.maxAge));
  const [strictAge, setStrictAge] = useState<boolean>(DEFAULT_FILTERS.strictAge);

  const [selectedSports, setSelectedSports] = useState<string[]>(DEFAULT_FILTERS.selectedSports);
  const [showMyProfile, setShowMyProfile] = useState<boolean>(DEFAULT_FILTERS.showMyProfile);


  // Track measurements for smooth touch slider
  const trackWidthRef = useRef<number>(0);
  const trackPageXRef = useRef<number>(0);
  const trackViewRef = useRef<ViewInstance>(null);

  // Load saved preferences from AsyncStorage on mount
  useEffect(() => {
    async function loadSavedFilters() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: MatchFilterSettings = JSON.parse(stored);
          setMaxDistance(parsed.maxDistance ?? DEFAULT_FILTERS.maxDistance);
          setStrictDistance(parsed.strictDistance ?? DEFAULT_FILTERS.strictDistance);
          setMinAge(String(parsed.minAge ?? DEFAULT_FILTERS.minAge));
          setMaxAge(String(parsed.maxAge ?? DEFAULT_FILTERS.maxAge));
          setStrictAge(parsed.strictAge ?? DEFAULT_FILTERS.strictAge);
          setSelectedSports(parsed.selectedSports ?? DEFAULT_FILTERS.selectedSports);
          setShowMyProfile(parsed.showMyProfile ?? DEFAULT_FILTERS.showMyProfile);
        }
      } catch (e) {
        console.warn('Gagal memuat filter lokal:', e);
      } finally {
        setLoading(false);
      }
    }
    loadSavedFilters();
  }, []);

  // Compute percentage for distance track (1 - 100 km)
  const distancePercent = Math.min(Math.max(((maxDistance - 1) / 99) * 100, 0), 100);

  // Helper to map coordinate X directly to snapped distance 1..100
  const updateDistanceByTouchX = (touchX: number) => {
    if (trackWidthRef.current <= 0) return;
    const clampedX = Math.max(0, Math.min(touchX, trackWidthRef.current));
    const ratio = clampedX / trackWidthRef.current;
    // Map ratio 0..1 to integer 1..100
    const rawKm = Math.round(1 + ratio * 99);
    setMaxDistance(Math.min(Math.max(rawKm, 1), 100));
  };

  // PanResponder for smooth sliding & dragging on the custom track
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateDistanceByTouchX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateDistanceByTouchX(evt.nativeEvent.locationX);
      },
    })
  ).current;

  // Sports selection toggles
  const toggleSport = (id: string) => {
    setSelectedSports((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllSports = () => {
    if (selectedSports.length === AVAILABLE_SPORTS.length) {
      setSelectedSports([]);
    } else {
      setSelectedSports(AVAILABLE_SPORTS.map((s) => s.id));
    }
  };

  // Age input validation
  const handleMinAgeChange = (val: string) => {
    setMinAge(val.replace(/[^0-9]/g, ''));
  };

  const handleMaxAgeChange = (val: string) => {
    setMaxAge(val.replace(/[^0-9]/g, ''));
  };

  // Save filters to AsyncStorage, Supabase (if available), and router navigation
  const handleSave = async () => {
    const parsedMin = parseInt(minAge, 10) || 18;
    const parsedMax = parseInt(maxAge, 10) || 40;

    if (parsedMin < 18) {
      Alert.alert(tr('filters.ageRange'), tr('filters.minAge'));
      return;
    }
    if (parsedMin > parsedMax) {
      Alert.alert(tr('filters.ageRange'), tr('filters.minOverMax'));
      return;
    }
    if (selectedSports.length === 0) {
      Alert.alert(tr('filters.sports'), tr('filters.pickOne'));
      return;
    }

    const payload: MatchFilterSettings = {
      maxDistance,
      strictDistance,
      minAge: parsedMin,
      maxAge: parsedMax,
      strictAge,
      selectedSports,
      showMyProfile,
    };

    setSaving(true);
    try {
      // 1. Persist to local AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      // 2. Persist to Supabase if connected
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({
          age_pref_min: parsedMin,
          age_pref_max: parsedMax,
          is_ghost_mode: !showMyProfile,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      }

      // 3. Return to previous screen with filters encoded in navigation params
      router.back();
    } catch (err) {
      Alert.alert(tr('filters.error'), tr('filters.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={t.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ExpoStatusBar style="auto" />

      {/* TOP HEADER */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('common.back')}
          style={styles.headerBackBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{tr('filters.title')}</Text>

        <TouchableOpacity accessibilityRole="button"
          style={[styles.headerDoneBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={t.primary} />
          ) : (
            <Text style={styles.headerDoneText}>{tr('filters.done')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: LOKASI & JARAK */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="location-sharp" size={16} color={t.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr('filters.location')}</Text>
            </View>
            <Text style={styles.highlightBadge}>{maxDistance} km</Text>
          </View>

          <Text style={styles.label}>
            {tr('filters.maxDistance')} <Text style={styles.boldText}>{maxDistance} km</Text>
          </Text>

          {/* Interactive touch/drag slider track */}
          <View
            ref={trackViewRef}
            style={styles.sliderInteractiveWrapper}
            onLayout={(e) => {
              trackWidthRef.current = e.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
          >
            <View style={styles.sliderBaseTrack}>
              <View
                style={[
                  styles.sliderFillTrack,
                  { width: `${distancePercent}%` },
                ]}
              />
            </View>
            {/* Draggable Thumb Knob */}
            <View
              style={[
                styles.sliderThumb,
                { left: `${distancePercent}%` },
              ]}
            >
              <View style={styles.sliderThumbCore} />
            </View>
          </View>

          <View style={styles.sliderRangeLabels}>
            <Text style={styles.rangeSubText}>1 km</Text>
            <Text style={styles.rangeSubText}>50 km</Text>
            <Text style={styles.rangeSubText}>100 km</Text>
          </View>

          {/* Syncing Preset Chips */}
          <View style={styles.distanceChipsRow}>
            {DISTANCE_PRESETS.map((km) => {
              const active = maxDistance === km;
              return (
                <TouchableOpacity accessibilityRole="button"
                  key={`dist-${km}`}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => setMaxDistance(km)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.presetChipText, active && styles.presetChipTextActive]}
                  >
                    {km} km
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* Strict Distance Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>{tr('filters.onlyInRange')}</Text>
              <Text style={styles.toggleSubtitle}>
                {tr('filters.hideBeyond', { km: maxDistance })}
              </Text>
            </View>
            <Toggle value={strictDistance} onValueChange={setStrictDistance} />
          </View>
        </View>

        {/* SECTION 2: PREFERENSI UMUR */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={16} color={t.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr('filters.agePref')}</Text>
            </View>
            <Text style={styles.highlightBadge}>
              {tr('filters.ageValue', { min: minAge || '18', max: maxAge || '40' })}
            </Text>
          </View>

          <Text style={styles.label}>{tr('filters.ageRangeHint')}</Text>

          <View style={styles.ageInputsContainer}>
            <View style={styles.ageInputBox}>
              <Text style={styles.ageInputLabel}>{tr('filters.min')}</Text>
              <View style={styles.ageRow}>
                <TextInput
                  style={styles.ageInput}
                  value={minAge}
                  onChangeText={handleMinAgeChange}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="18"
                  placeholderTextColor={t.textMuted}
                />
                <Text style={styles.ageUnit}>{tr('filters.yrs')}</Text>
              </View>
            </View>

            <View style={styles.ageSeparator}>
              <Ionicons name="remove-outline" size={24} color={t.textSecondary} />
            </View>

            <View style={styles.ageInputBox}>
              <Text style={styles.ageInputLabel}>{tr('filters.max')}</Text>
              <View style={styles.ageRow}>
                <TextInput
                  style={styles.ageInput}
                  value={maxAge}
                  onChangeText={handleMaxAgeChange}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="40"
                  placeholderTextColor={t.textMuted}
                />
                <Text style={styles.ageUnit}>{tr('filters.yrs')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>{tr('filters.strictAge')}</Text>
              <Text style={styles.toggleSubtitle}>
                {tr('filters.strictHint', { min: minAge || '18', max: maxAge || '40' })}
              </Text>
            </View>
            <Toggle value={strictAge} onValueChange={setStrictAge} />
          </View>
        </View>

        {/* SECTION 3: OLAHRAGA */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="barbell-outline" size={16} color={t.primary} />
              </View>
              <Text style={styles.sectionTitle}>{tr('filters.sports')}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={selectAllSports}>
              <Text style={styles.textBtn}>
                {selectedSports.length === AVAILABLE_SPORTS.length ? tr('filters.reset') : tr('filters.selectAll')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            {tr('filters.sportsHint')}
          </Text>

          <View style={styles.sportsGrid}>
            {AVAILABLE_SPORTS.map((sport) => {
              const isSelected = selectedSports.includes(sport.id);
              return (
                <TouchableOpacity accessibilityRole="button"
                  key={sport.id}
                  style={[styles.sportPill, isSelected && styles.sportPillActive]}
                  onPress={() => toggleSport(sport.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={sport.icon}
                    size={15}
                    color={isSelected ? '#FFFFFF' : t.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sportPillText,
                      isSelected && styles.sportPillTextActive,
                    ]}
                  >
                    {sport.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={14} color={t.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SECTION 4: TAMPILKAN PROFILKU (GHOST MODE) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View
                style={[
                  styles.iconCircle,
                  !showMyProfile && { backgroundColor: t.dangerSoft },
                ]}
              >
                <Ionicons
                  name={showMyProfile ? 'eye-outline' : 'eye-off-outline'}
                  size={16}
                  color={showMyProfile ? t.primary : t.danger}
                />
              </View>
              <Text style={styles.sectionTitle}>{tr('filters.showMe')}</Text>
            </View>
            <View
              style={[
                styles.ghostBadge,
                !showMyProfile && styles.ghostBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.ghostBadgeText,
                  !showMyProfile && styles.ghostBadgeTextActive,
                ]}
              >
                {showMyProfile ? tr('filters.open') : tr('filters.ghost')}
              </Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>
                {showMyProfile ? tr('filters.visibleTitle') : tr('filters.ghostTitle')}
              </Text>
              <Text style={styles.toggleSubtitle}>
                {showMyProfile
                  ? tr('filters.visibleBody')
                  : tr('filters.ghostBody')}
              </Text>
            </View>
            <Toggle value={showMyProfile} onValueChange={setShowMyProfile} />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: t.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.hairline,
    backgroundColor: t.bg,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: t.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Lato_700Bold',
    color: t.text,
  },
  headerDoneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: t.primarySoft,
    minWidth: 64,
    alignItems: 'center',
  },
  headerDoneText: {
    fontSize: 14,
    fontFamily: 'Lato_700Bold',
    color: t.primary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: t.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: t.hairline,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Lato_700Bold',
    color: t.text,
  },
  highlightBadge: {
    fontSize: 13,
    fontFamily: 'Lato_700Bold',
    color: t.primary,
    backgroundColor: t.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  label: {
    fontSize: 13,
    color: t.textSecondary,
    marginBottom: 14,
  },
  boldText: {
    color: t.text,
    fontFamily: 'Lato_700Bold',
  },
  sliderInteractiveWrapper: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 10,
  },
  sliderBaseTrack: {
    height: 6,
    backgroundColor: t.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFillTrack: {
    height: '100%',
    backgroundColor: t.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginLeft: -12, // center the knob
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderThumbCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.primary,
  },
  sliderRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 10,
  },
  rangeSubText: {
    fontSize: 11,
    color: t.textMuted,
    fontFamily: 'Lato_700Bold',
  },
  distanceChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: t.surfaceMuted,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: t.primarySoft,
    borderColor: t.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: 'Lato_700Bold',
    color: t.textSecondary,
  },
  presetChipTextActive: {
    color: t.primary,
    fontFamily: 'Lato_700Bold',
  },
  divider: {
    height: 1,
    backgroundColor: t.hairline,
    marginVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    paddingRight: 12,
  },
  toggleTitle: {
    fontSize: 14,
    fontFamily: 'Lato_700Bold',
    color: t.text,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: t.textSecondary,
    lineHeight: 16,
  },
  ageInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ageInputBox: {
    flex: 1,
    backgroundColor: t.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  ageInputLabel: {
    fontSize: 10,
    fontFamily: 'Lato_700Bold',
    color: t.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ageInput: {
    fontSize: 22,
    fontFamily: 'Lato_700Bold',
    color: t.text,
    padding: 0,
    minWidth: 40,
  },
  ageUnit: {
    fontSize: 13,
    color: t.textSecondary,
    marginLeft: 4,
  },
  ageSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtn: {
    fontSize: 12,
    fontFamily: 'Lato_700Bold',
    color: t.primary,
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
    backgroundColor: t.surfaceMuted,
    borderWidth: 1,
    borderColor: t.hairline,
  },
  sportPillActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  sportPillText: {
    fontSize: 13,
    color: t.textSecondary,
    fontFamily: 'Lato_400Regular',
  },
  sportPillTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Lato_700Bold',
  },
  ghostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: t.successSoft,
  },
  ghostBadgeActive: {
    backgroundColor: t.dangerSoft,
  },
  ghostBadgeText: {
    fontSize: 11,
    fontFamily: 'Lato_700Bold',
    color: t.success,
  },
  ghostBadgeTextActive: {
    color: t.danger,
  },
}));
