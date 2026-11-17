import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Button, IconButton } from '@/components/ui';
import { assetUrl, meApi, type Photo } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { useSportName, useT, type TKey } from '@/lib/i18n';

import { useTheme, makeStyles, type Theme, type, space, radius, fonts } from '@/lib/theme';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = space.md;
const CARD_PADDING = space.lg;
const GRID_GAP = space.sm;
const AVAILABLE_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2) - (CARD_PADDING * 2) - 2; // -2 for borders
const PHOTO_SIZE = Math.floor((AVAILABLE_WIDTH - GRID_GAP) / 2) - 1; // -1 for flex safety
const MAX_PHOTOS = 4;

/** Same ids as onboarding; anything else a player typed is a custom sport. */
const MAX_SPORTS = 8;
const SPORTS_OPTIONS = [
  { id: 'badminton', icon: 'tennisball-outline' as const },
  { id: 'tenis', icon: 'tennisball-outline' as const },
  { id: 'tenismeja', icon: 'tennisball-outline' as const },
  { id: 'padel', icon: 'tennisball-outline' as const },
  { id: 'futsal', icon: 'football-outline' as const },
  { id: 'minisoccer', icon: 'football-outline' as const },
  { id: 'basket', icon: 'basketball-outline' as const },
  { id: 'voli', icon: 'basketball-outline' as const },
  { id: 'lari', icon: 'walk-outline' as const },
  { id: 'sepeda', icon: 'bicycle-outline' as const },
  { id: 'gym', icon: 'barbell-outline' as const },
  { id: 'yoga', icon: 'body-outline' as const },
  { id: 'pilates', icon: 'flower-outline' as const },
  { id: 'calisthenics', icon: 'barbell-outline' as const },
  { id: 'zumba', icon: 'musical-notes-outline' as const },
  { id: 'renang', icon: 'water-outline' as const },
  { id: 'boxing', icon: 'fitness-outline' as const },
  { id: 'beladiri', icon: 'body-outline' as const },
  { id: 'hiking', icon: 'trail-sign-outline' as const },
  { id: 'panjat', icon: 'trending-up-outline' as const },
  { id: 'golf', icon: 'golf-outline' as const },
];

const SKILL_LEVELS = [
  { id: 'Casual', label: 'Casual / Fun', desc: 'editProfile.casualDesc' },
  { id: 'Intermediate', label: 'Intermediate', desc: 'editProfile.intermediateDesc' },
  { id: 'Kompetitif', label: 'Competitive', desc: 'editProfile.competitiveDesc' },
];

export default function EditProfileScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me, setMe } = useAuth();
  const sportName = useSportName();
  const profile = me?.profile;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const [bio, setBio] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [saving, setSaving] = useState(false);
  const [customSport, setCustomSport] = useState('');

  // States for Custom Scrollbar
  const [contentHeight, setContentHeight] = useState(1);
  const [scrollViewHeight, setScrollViewHeight] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Photos are saved the moment they change; the text fields load once.
  useEffect(() => {
    if (me) setPhotos(me.photos.slice(0, MAX_PHOTOS));
  }, [me]);

  const loaded = React.useRef(false);
  useEffect(() => {
    if (!me || loaded.current) return;
    loaded.current = true;
    setBio(me.profile.bio || '');
    setLookingFor(me.profile.lookingFor || '');
    setSkillLevel(me.profile.skillLevel || 'Intermediate');
    setSelectedSports(me.sports.map((x) => x.sportId));
  }, [me]);

  const limitReached = () => Alert.alert(tr('editProfile.limitTitle'), tr('editProfile.limitBody'));

  const toggleSport = (sportId: string) => {
    if (selectedSports.includes(sportId)) {
      setSelectedSports(selectedSports.filter((id) => id !== sportId));
    } else {
      if (selectedSports.length >= MAX_SPORTS) return limitReached();
      setSelectedSports([...selectedSports, sportId]);
    }
  };

  const addCustomSport = () => {
    const name = customSport.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 30);
    if (name.length < 2) return;
    const known = SPORTS_OPTIONS.find((o) => o.id === name || sportName(o.id).toLowerCase() === name);
    const id = known ? known.id : name;
    if (!selectedSports.includes(id)) {
      if (selectedSports.length >= MAX_SPORTS) return limitReached();
      setSelectedSports([...selectedSports, id]);
    }
    setCustomSport('');
  };

  const customSelected = selectedSports.filter((id) => !SPORTS_OPTIONS.some((o) => o.id === id));

  const handlePickImage = async () => {
    try {
      const remainingSlots = MAX_PHOTOS - photos.length;
      if (remainingSlots <= 0) {
        Alert.alert(tr('editProfile.fullTitle'), tr('editProfile.fullBody'));
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(tr('editProfile.permTitle'), tr('editProfile.permBody'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets) return;

      setUploadingIndex(-1); // Indicates global uploading state
      for (const asset of result.assets.slice(0, remainingSlots)) {
        setMe(await meApi.uploadPhoto(asset.uri, asset.mimeType ?? 'image/jpeg'));
      }
    } catch (err) {
      Alert.alert(tr('editProfile.uploadFailed'), apiErrorMessage(err, tr));
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    try {
      setMe(await meApi.deletePhoto(photo.id));
    } catch (err) {
      Alert.alert(tr('editProfile.uploadFailed'), apiErrorMessage(err, tr));
    }
  };

  const handleMakePrimary = async (index: number) => {
    if (index === 0) return; // Already primary
    const ids = photos.map((p) => p.id);
    const [picked] = ids.splice(index, 1);
    ids.unshift(picked!);
    try {
      setMe(await meApi.reorderPhotos(ids));
    } catch (err) {
      Alert.alert(tr('editProfile.uploadFailed'), apiErrorMessage(err, tr));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await meApi.updateProfile({ bio: bio.trim() || null, lookingFor: lookingFor.trim() || null, skillLevel });
      // Keep each sport's experience level from onboarding.
      const levels = new Map((me?.sports ?? []).map((x) => [x.sportId, x.experienceLevel]));
      const updated = await meApi.setSports(
        selectedSports.map((sportId) => ({ sportId, experienceLevel: levels.get(sportId) ?? '1-3 thn' })),
      );
      setMe(updated);
      router.back();
    } catch (err) {
      Alert.alert(tr('editProfile.saveFailed'), apiErrorMessage(err, tr));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={tr('common.back')} />
        <Text style={styles.barTitle}>{tr('editProfile.title')}</Text>
        <Button label={tr('editProfile.save')} size="sm" onPress={handleSave} loading={saving} />
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        showsVerticalScrollIndicator={false}
      >


        {/* Section 1: Photos */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>{tr('editProfile.photos')}</Text>
            <Text style={styles.caption}>{photos.length}/{MAX_PHOTOS}</Text>
          </View>
          <Text style={[styles.hint, { marginBottom: space.md }]}>
            {tr('editProfile.photosHint')}
          </Text>

          <View style={styles.grid}>
            {Array.from({ length: MAX_PHOTOS }).map((_, idx) => {
              const photo = photos[idx];
              const isUploading = uploadingIndex === idx;
              const isPrimary = idx === 0;

              if (photo) {
                return (
                  <TouchableOpacity accessibilityRole="button" 
                    key={idx} 
                    style={[styles.photoCard, isPrimary && styles.photoCardPrimary]}
                    activeOpacity={0.9}
                    onPress={() => handleMakePrimary(idx)}
                  >
                    <Image source={{ uri: assetUrl(photo.url) }} style={styles.photoImg} />
                    {isPrimary && (
                      <View style={styles.badgePrimary}>
                        <Text style={styles.badgePrimaryText}>{tr('editProfile.main')}</Text>
                      </View>
                    )}
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('a11y.removePhoto')}
                      style={styles.btnRemove}
                      onPress={() => handleRemovePhoto(idx)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity accessibilityRole="button"
                  key={idx}
                  style={[styles.photoCard, styles.photoCardEmpty, isPrimary && styles.photoCardPrimaryEmpty]}
                  onPress={handlePickImage}
                  disabled={uploadingIndex !== null}
                  activeOpacity={0.7}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={t.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name="add"
                        size={22}
                        color={isPrimary ? t.primary : t.textMuted}
                      />
                      <Text style={[styles.emptyLabel, isPrimary && { color: t.primary }]}>
                        {isPrimary ? tr('editProfile.mainPhoto') : tr('editProfile.add')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 4: About / Bio */}
        <View style={styles.cardContainer}>
          <Text style={styles.sectionTitle}>{tr('editProfile.about')}</Text>
          <Text style={[styles.hint, { marginTop: space.xxs, marginBottom: space.sm }]}>
            {tr('editProfile.aboutHint')}
          </Text>

          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder={tr('editProfile.aboutPlaceholder')}
            placeholderTextColor={t.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Section 5: Looking For */}
        <View style={styles.cardContainer}>
          <Text style={styles.sectionTitle}>{tr('editProfile.lookingFor')}</Text>
          <Text style={[styles.hint, { marginTop: space.xxs, marginBottom: space.sm }]}>
            {tr('editProfile.lookingForHint')}
          </Text>

          <TextInput
            style={[styles.input, styles.bioInput]}
            value={lookingFor}
            onChangeText={setLookingFor}
            placeholder={tr('editProfile.lookingForPlaceholder')}
            placeholderTextColor={t.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
      {/* Section 2: Sports Identity */}
        <View style={styles.cardContainer}>
          <Text style={styles.sectionTitle}>{tr('editProfile.sports')}</Text>
          <Text style={[styles.hint, { marginTop: space.xxs, marginBottom: space.sm }]}>
            {tr('editProfile.sportsHint')}
          </Text>

          <View style={{ height: 210, backgroundColor: t.bg, borderRadius: 16, padding: space.xs, flexDirection: 'row' }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              onContentSizeChange={(_, h) => setContentHeight(h > 0 ? h : 1)}
              onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height > 0 ? e.nativeEvent.layout.height : 1)}
              onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
            >
              <View style={styles.chipsRow}>
                {SPORTS_OPTIONS.map((sport) => {
                  const active = selectedSports.includes(sport.id);
                  return (
                    <TouchableOpacity accessibilityRole="button"
                      key={sport.id}
                      style={[styles.sportChip, active && styles.sportChipActive]}
                      onPress={() => toggleSport(sport.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={sport.icon}
                        size={15}
                        color={active ? '#FFFFFF' : t.textSecondary}
                        style={{ marginRight: space.xxs }}
                      />
                      <Text style={[styles.sportChipText, active && styles.sportChipTextActive]}>
                        {sportName(sport.id)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {customSelected.map((id) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={id}
                    style={[styles.sportChip, styles.sportChipActive]}
                    onPress={() => toggleSport(id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="fitness-outline" size={15} color="#FFFFFF" style={{ marginRight: space.xxs }} />
                    <Text style={[styles.sportChipText, styles.sportChipTextActive]}>{sportName(id)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Custom Thick Scrollbar */}
            {contentHeight > scrollViewHeight && (
              <View style={{ width: 6, backgroundColor: t.surfaceMuted, borderRadius: 3, marginLeft: space.xs }}>
                <View 
                  style={{ 
                    width: 6, 
                    borderRadius: 3, 
                    backgroundColor: t.textMuted,
                    height: Math.max(scrollViewHeight * (scrollViewHeight / contentHeight), 30), // Minimum thumb height
                    transform: [{ 
                      translateY: scrollOffset * ((scrollViewHeight - Math.max(scrollViewHeight * (scrollViewHeight / contentHeight), 30)) / (contentHeight - scrollViewHeight || 1))
                    }]
                  }} 
                />
              </View>
            )}
          </View>

          <TextInput
            style={[styles.input, { marginTop: space.sm }]}
            value={customSport}
            onChangeText={setCustomSport}
            onSubmitEditing={addCustomSport}
            returnKeyType="done"
            maxLength={30}
            placeholder={tr('editProfile.otherPlaceholder')}
            placeholderTextColor={t.textMuted}
          />

          <Text style={[styles.sectionTitle, { marginTop: space.xl }]}>
            {tr('editProfile.level')}
          </Text>
          <View style={{ gap: space.xs, marginTop: space.xs }}>
            {SKILL_LEVELS.map((lvl) => {
              const active = skillLevel === lvl.id;
              return (
                <TouchableOpacity accessibilityRole="button"
                  key={lvl.id}
                  style={[styles.skillBox, active && styles.skillBoxActive]}
                  onPress={() => setSkillLevel(lvl.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.skillTitle, active && { color: t.text }]}>
                      {lvl.label}
                    </Text>
                    <Text style={styles.skillDesc}>{tr(lvl.desc as TKey)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

                </ScrollView>
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.border,
  },
  barTitle: { ...type.heading, color: t.text },
  sectionTitle: { ...type.heading, color: t.text },
  caption: { ...type.caption, color: t.textSecondary },
  hint: { ...type.callout, color: t.textSecondary },
  saveAction: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: t.primary,
    borderRadius: radius.pill,
  },
  saveActionText: {
    fontSize: 14,
    fontFamily: 'Lato_700Bold',
    color: '#FFFFFF',
  },
  cardContainer: {
    backgroundColor: t.surface,
    marginHorizontal: space.md,
    marginTop: space.md,
    borderRadius: 24,
    padding: space.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
    borderRadius: 12,
    backgroundColor: t.surfaceMuted,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.border,
    position: 'relative',
  },
  photoCardPrimary: {
    borderColor: t.primary,
  },
  photoCardEmpty: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCardPrimaryEmpty: {
    borderColor: 'rgba(255, 90, 54, 0.4)',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  badgePrimary: {
    position: 'absolute',
    top: space.xs,
    left: space.xs,
    backgroundColor: t.primary,
    paddingHorizontal: space.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePrimaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Lato_700Bold',
    textTransform: 'uppercase',
  },
  btnRemove: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    backgroundColor: 'rgba(8, 10, 15, 0.75)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    ...type.caption,
    color: t.textSecondary,
    marginTop: space.xxs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surfaceMuted,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: t.border,
  },
  sportChipActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
  },
  sportChipText: {
    fontSize: 13,
    fontFamily: 'Lato_400Regular',
    color: t.textSecondary,
  },
  sportChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Lato_700Bold',
  },
  skillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surfaceMuted,
    borderRadius: 12,
    padding: space.sm,
    borderWidth: 1,
    borderColor: t.border,
  },
  skillBoxActive: {
    borderColor: t.primary,
    backgroundColor: t.primarySoft,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: t.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  radioCircleActive: {
    borderColor: t.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.primary,
  },
  skillTitle: {
    fontSize: 14,
    fontFamily: 'Lato_700Bold',
    color: t.textSecondary,
  },
  skillDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: t.textMuted,
    marginTop: 2,
  },
  fieldGroup: {
    marginTop: space.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Lato_400Regular',
    color: t.textSecondary,
    marginBottom: space.xxs,
  },
  input: {
    backgroundColor: t.bg,
    borderRadius: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: t.text,
    fontSize: 16,
    fontFamily: 'Lato_400Regular',
    borderWidth: 1,
    borderColor: t.border,
  },
  bioInput: {
    height: 96,
    textAlignVertical: 'top',
  },
}));
