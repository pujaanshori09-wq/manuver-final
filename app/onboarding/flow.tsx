import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, GlossFill, ProgressHeader, RangeSlider, TextField, glossShadow } from '@/components/ui';
import { LANGUAGES, TKey, toAccountLanguage, translate, useLanguage, useT } from '@/lib/i18n';
import { makeStyles, type, useTheme } from '@/lib/theme';
import { meApi } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';

const TOTAL_STEPS = 6;
const STEP_LANGUAGE = 0;
const STEP_RULES = 1;
const STEP_SPORTS = 2;
const STEP_EXPERIENCE = 3;
const STEP_ABOUT = 4;
const STEP_LOCATION = 5;

/** Server limit (PUT /me/sports). */
const MAX_SPORTS = 8;
/** The right end of the partner-age slider means "40 and older, no upper limit". */
const AGE_SLIDER_MAX = 40;
const AGE_OPEN_ENDED = 99;

type IconName = keyof typeof Ionicons.glyphMap;
type Group = 'racket' | 'ball' | 'endurance' | 'fitness' | 'water' | 'combat' | 'outdoor';

// Sport ids are stored in the database; custom sports typed under "Other" are stored as typed (lowercase).
const SPORTS_CATALOG: { id: string; icon: IconName; group: Group }[] = [
  { id: 'badminton', icon: 'tennisball-outline', group: 'racket' },
  { id: 'tenis', icon: 'tennisball-outline', group: 'racket' },
  { id: 'tenismeja', icon: 'tennisball-outline', group: 'racket' },
  { id: 'padel', icon: 'tennisball-outline', group: 'racket' },
  { id: 'futsal', icon: 'football-outline', group: 'ball' },
  { id: 'minisoccer', icon: 'football-outline', group: 'ball' },
  { id: 'basket', icon: 'basketball-outline', group: 'ball' },
  { id: 'voli', icon: 'basketball-outline', group: 'ball' },
  { id: 'lari', icon: 'walk-outline', group: 'endurance' },
  { id: 'sepeda', icon: 'bicycle-outline', group: 'endurance' },
  { id: 'gym', icon: 'barbell-outline', group: 'fitness' },
  { id: 'yoga', icon: 'body-outline', group: 'fitness' },
  { id: 'pilates', icon: 'flower-outline', group: 'fitness' },
  { id: 'calisthenics', icon: 'barbell-outline', group: 'fitness' },
  { id: 'zumba', icon: 'musical-notes-outline', group: 'fitness' },
  { id: 'renang', icon: 'water-outline', group: 'water' },
  { id: 'boxing', icon: 'fitness-outline', group: 'combat' },
  { id: 'beladiri', icon: 'body-outline', group: 'combat' },
  { id: 'hiking', icon: 'trail-sign-outline', group: 'outdoor' },
  { id: 'panjat', icon: 'trending-up-outline', group: 'outdoor' },
  { id: 'golf', icon: 'golf-outline', group: 'outdoor' },
];
const GROUPS: Group[] = ['racket', 'ball', 'endurance', 'fitness', 'water', 'combat', 'outdoor'];

// Stored values; only the labels are translated. ("3+ thn" from older accounts still displays fine.)
const EXPERIENCE_OPTIONS: { id: string; label: TKey }[] = [
  { id: '< 6 bln', label: 'experience.lt6m' },
  { id: '6 bln-1 thn', label: 'experience.m6to1y' },
  { id: '1-3 thn', label: 'experience.y1to3' },
  { id: '3-6 thn', label: 'experience.y3to6' },
  { id: '6+ thn', label: 'experience.y6plus' },
];
const DEFAULT_EXPERIENCE = '1-3 thn';

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export default function OnboardingFlowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { me, setMe } = useAuth();
  const { language, setLanguage } = useLanguage();
  const tr = useT();
  const t = useTheme();
  const s = useStyles();

  const [currentStep, setCurrentStep] = useState(0);

  // Onboarding form state
  const [houseRulesAccepted, setHouseRulesAccepted] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>(['badminton', 'lari']);
  const [customSports, setCustomSports] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [showExpAdd, setShowExpAdd] = useState(false);
  const [sportExperience, setSportExperience] = useState<Record<string, string>>({
    badminton: DEFAULT_EXPERIENCE,
    lari: '6 bln-1 thn',
  });
  const [ageRange, setAgeRange] = useState<[number, number]>([20, 32]);
  const [genderPref, setGenderPref] = useState<'all' | 'men' | 'women'>('all');
  const [myGender, setMyGender] = useState<'male' | 'female' | 'other'>('male');
  const [myAge, setMyAge] = useState<string>('20');
  // Phone sign-ups have no name yet; Google/email ones arrive with it (still editable later).
  const needsName = !me?.profile.name;
  const [myName, setMyName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Radar pulse
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const pulse3 = useSharedValue(0);

  useEffect(() => {
    const loop = (v: SharedValue<number>) =>
      (v.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
    loop(pulse1);
    const a = setTimeout(() => loop(pulse2), 800);
    const b = setTimeout(() => loop(pulse3), 1600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const goToStep = (stepIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrentStep(stepIndex);
    scrollRef.current?.scrollTo({ x: stepIndex * SCREEN_WIDTH, animated: true });
  };

  const warn = (title: string, body: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(title, body);
  };

  const handleNext = () => {
    if (currentStep === STEP_RULES && !houseRulesAccepted) {
      return warn(tr('onboarding.rulesRequiredTitle'), tr('onboarding.rulesRequiredBody'));
    }
    if (currentStep === STEP_SPORTS && selectedSports.length === 0) {
      return warn(tr('onboarding.sportsRequiredTitle'), tr('onboarding.sportsRequiredBody'));
    }
    if (currentStep === STEP_ABOUT) {
      if (needsName && !myName.trim()) return warn(tr('onboarding.nameInvalidTitle'), tr('onboarding.nameInvalidBody'));
      const age = parseInt(myAge, 10);
      if (!age || age < 18 || age > 99) return warn(tr('onboarding.ageInvalidTitle'), tr('onboarding.ageInvalidBody'));
    }

    if (currentStep < TOTAL_STEPS - 1) goToStep(currentStep + 1);
    else finishOnboarding();
  };

  const handleBack = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
    else if (router.canGoBack()) router.back();
  };

  // ── sports ───────────────────────────────────────────────────────────────────
  const sportName = (id: string) => {
    const key = `sports.${id}` as TKey;
    const label = tr(key);
    return label === key ? titleCase(id) : label; // custom sport: show what the player typed
  };
  const sportIcon = (id: string): IconName => SPORTS_CATALOG.find((x) => x.id === id)?.icon ?? 'fitness-outline';

  const limitReached = () => warn(tr('onboarding.sportLimitTitle'), tr('onboarding.sportLimitBody'));

  const toggleSport = (sportId: string) => {
    if (selectedSports.includes(sportId)) {
      setSelectedSports((prev) => prev.filter((id) => id !== sportId));
      setCustomSports((prev) => prev.filter((id) => id !== sportId)); // a custom sport disappears when deselected
      return;
    }
    if (selectedSports.length >= MAX_SPORTS) return limitReached();
    setSportExperience((exp) => (exp[sportId] ? exp : { ...exp, [sportId]: DEFAULT_EXPERIENCE }));
    setSelectedSports((prev) => [...prev, sportId]);
  };

  /** Adds a sport typed under "Other". A known sport's name selects the catalog entry instead. */
  const addCustomSport = (raw: string): boolean => {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      warn(tr('onboarding.otherSport'), tr('onboarding.sportTooShort'));
      return false;
    }
    const id = name.toLowerCase().slice(0, 30);
    const known = SPORTS_CATALOG.find((x) => x.id === id || sportName(x.id).toLowerCase() === id);
    const finalId = known ? known.id : id;
    if (selectedSports.includes(finalId)) return true;
    if (selectedSports.length >= MAX_SPORTS) {
      limitReached();
      return false;
    }
    setSelectedSports((prev) => [...prev, finalId]);
    setSportExperience((exp) => (exp[finalId] ? exp : { ...exp, [finalId]: DEFAULT_EXPERIENCE }));
    if (!known) setCustomSports((prev) => (prev.includes(finalId) ? prev : [...prev, finalId]));
    Haptics.selectionAsync().catch(() => {});
    return true;
  };

  const setExperienceForSport = (sportId: string, level: string) => {
    setSportExperience((prev) => ({ ...prev, [sportId]: level }));
  };

  // ── submit ───────────────────────────────────────────────────────────────────
  const finishOnboarding = async () => {
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      // Birth date from the age entered (Jan 1st of that year).
      const birthYear = new Date().getFullYear() - parseInt(myAge || '20', 10);
      const updated = await meApi.completeOnboarding({
        name: (needsName ? myName.trim() : me?.profile.name) || me?.email?.split('@')[0] || 'Player',
        birthDate: `${birthYear}-01-01`,
        gender: myGender === 'female' ? 'FEMALE' : myGender === 'other' ? 'OTHER' : 'MALE',
        genderPreference: genderPref === 'men' ? 'MEN' : genderPref === 'women' ? 'WOMEN' : 'ALL',
        ageMin: ageRange[0],
        // The slider's right end ("40+") has no upper limit.
        ageMax: ageRange[1] >= AGE_SLIDER_MAX ? AGE_OPEN_ENDED : ageRange[1],
        language: toAccountLanguage(language),
        sports: selectedSports.map((sportId) => ({ sportId, experienceLevel: sportExperience[sportId] || DEFAULT_EXPERIENCE })),
        acceptTerms: true,
      });
      setMe(updated); // onboardingCompleted → the root navigator opens the app
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert(tr('onboarding.saveFailedTitle'), apiErrorMessage(e, tr));
    } finally {
      setSubmitting(false);
    }
  };

  const ctaLabel =
    currentStep === STEP_LOCATION
      ? submitting
        ? tr('onboarding.starting')
        : tr('onboarding.start')
      : currentStep === STEP_RULES
        ? tr('onboarding.agreeCta')
        : currentStep === STEP_SPORTS && selectedSports.length > 0
          ? `${tr('common.next')} · ${tr('onboarding.selectedCount', { n: selectedSports.length })}`
          : currentStep === STEP_LANGUAGE
            ? tr('common.continue')
            : tr('common.next');

  const ctaDisabled =
    (currentStep === STEP_RULES && !houseRulesAccepted) || (currentStep === STEP_SPORTS && selectedSports.length === 0);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ProgressHeader progress={(currentStep + 1) / TOTAL_STEPS} onBack={currentStep > 0 || router.canGoBack() ? handleBack : undefined} />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false} // Only advances via verified next buttons
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {/* 1 — Language (shown in both languages, so nobody needs to read the one they don't know) */}
        <Page width={SCREEN_WIDTH}>
          <Header
            title={translate('onboarding.languageTitle', undefined, 'en')}
            subtitle={translate('onboarding.languageTitle', undefined, 'id')}
          />
          <View style={s.langList} accessibilityRole="radiogroup">
            {LANGUAGES.map(({ code, native }) => (
              <LanguageOption
                key={code}
                label={native}
                selected={language === code}
                onPress={() => {
                  if (language === code) return;
                  Haptics.selectionAsync().catch(() => {});
                  setLanguage(code); // the rest of onboarding switches immediately
                }}
              />
            ))}
          </View>
          <Text style={s.hint}>{tr('onboarding.languageSubtitle')}</Text>
        </Page>

        {/* 2 — House rules */}
        <Page width={SCREEN_WIDTH}>
          <Header title={tr('onboarding.rulesTitle')} subtitle={tr('onboarding.rulesSubtitle')} />
          <View style={s.rules}>
            <RuleRow icon="shield-checkmark-outline" title={tr('onboarding.ruleSafetyTitle')} body={tr('onboarding.ruleSafetyBody')} />
            <RuleRow icon="time-outline" title={tr('onboarding.ruleSportTitle')} body={tr('onboarding.ruleSportBody')} />
            <RuleRow icon="hand-left-outline" title={tr('onboarding.ruleHarassTitle')} body={tr('onboarding.ruleHarassBody')} last />
          </View>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setHouseRulesAccepted(!houseRulesAccepted);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: houseRulesAccepted }}
            style={s.agreeRow}
          >
            <View style={[s.checkbox, houseRulesAccepted && s.checkboxOn]}>
              {houseRulesAccepted && (
                <>
                  <GlossFill highlight={false} />
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </>
              )}
            </View>
            <Text style={s.agreeText}>
              {tr('onboarding.agreePrefix')}
              <Text style={s.strong}>{tr('onboarding.agreeTerms')}</Text>
              {tr('onboarding.agreeAnd')}
              <Text style={s.strong}>{tr('onboarding.agreePrivacy')}</Text>.
            </Text>
          </Pressable>
        </Page>

        {/* 3 — Sports, grouped; "Other" lets players type their own */}
        <Page width={SCREEN_WIDTH}>
          <Header title={tr('onboarding.sportsTitle')} subtitle={tr('onboarding.sportsSubtitle')} />
          {GROUPS.map((g, gi) => (
            <View key={g} style={[s.group, gi === 0 && { borderTopWidth: 0, paddingTop: 4 }]}>
              <Text style={s.groupTitle}>{tr(`sportGroups.${g}` as TKey)}</Text>
              <View style={s.chips}>
                {SPORTS_CATALOG.filter((x) => x.group === g).map((sp) => (
                  <Chip
                    key={sp.id}
                    icon={sp.icon}
                    label={sportName(sp.id)}
                    selected={selectedSports.includes(sp.id)}
                    onPress={() => toggleSport(sp.id)}
                  />
                ))}
              </View>
            </View>
          ))}

          <View style={s.group}>
            <Text style={s.groupTitle}>{tr('onboarding.otherSport')}</Text>
            <View style={s.chips}>
              {customSports.map((id) => (
                <Chip key={id} icon="fitness-outline" label={sportName(id)} selected onPress={() => toggleSport(id)} />
              ))}
              <Chip
                icon={showOtherInput ? 'chevron-up' : 'add'}
                label={tr('onboarding.otherSport')}
                selected={showOtherInput}
                onPress={() => setShowOtherInput((v) => !v)}
              />
            </View>
            {showOtherInput && <AddSportInput onAdd={addCustomSport} />}
          </View>
        </Page>

        {/* 4 — Experience per sport, one question block each */}
        <Page width={SCREEN_WIDTH}>
          <Header title={tr('onboarding.expTitle')} subtitle={tr('onboarding.expSubtitle')} />
          {selectedSports.map((sportId, i) => {
            const currentExp = sportExperience[sportId] || DEFAULT_EXPERIENCE;
            return (
              <View key={sportId} style={[s.group, i === 0 && { borderTopWidth: 0, paddingTop: 4 }]}>
                <View style={s.questionRow}>
                  <Ionicons name={sportIcon(sportId)} size={22} color={t.text} />
                  <Text style={s.question}>{sportName(sportId)}</Text>
                </View>
                <View style={s.chips}>
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.id}
                      label={tr(opt.label)}
                      selected={currentExp === opt.id}
                      onPress={() => setExperienceForSport(sportId, opt.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          <View style={[s.group, selectedSports.length === 0 && { borderTopWidth: 0, paddingTop: 4 }]}>
            <View style={s.chips}>
              <Chip
                icon={showExpAdd ? 'chevron-up' : undefined}
                label={tr('onboarding.addOther')}
                selected={showExpAdd}
                onPress={() => setShowExpAdd((v) => !v)}
              />
            </View>
            {showExpAdd && <AddSportInput onAdd={addCustomSport} />}
          </View>
        </Page>

        {/* 5 — About you & who to show */}
        <Page width={SCREEN_WIDTH}>
          <Header title={tr('onboarding.aboutTitle')} subtitle={tr('onboarding.aboutSubtitle')} />
          {needsName ? (
            <View style={{ marginBottom: 24 }}>
              <TextField
                label={tr('onboarding.nameLabel')}
                value={myName}
                onChangeText={setMyName}
                placeholder={tr('onboarding.namePlaceholder')}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={60}
              />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <TextField
              label={tr('onboarding.ageLabel')}
              value={myAge}
              onChangeText={setMyAge}
              placeholder={tr('onboarding.agePlaceholder')}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={s.hint}>{tr('onboarding.ageHint')}</Text>
          </View>

          <View style={s.group}>
            <View style={s.questionRow}>
              <Ionicons name="person-outline" size={22} color={t.text} />
              <Text style={s.question}>{tr('onboarding.genderQuestion')}</Text>
            </View>
            <View style={s.chips}>
              <Chip label={tr('onboarding.male')} selected={myGender === 'male'} onPress={() => setMyGender('male')} />
              <Chip label={tr('onboarding.female')} selected={myGender === 'female'} onPress={() => setMyGender('female')} />
              <Chip label={tr('onboarding.otherGender')} selected={myGender === 'other'} onPress={() => setMyGender('other')} />
            </View>
          </View>

          <View style={s.group}>
            <View style={s.questionRow}>
              <Ionicons name="eye-outline" size={22} color={t.text} />
              <Text style={s.question}>{tr('onboarding.showMeQuestion')}</Text>
            </View>
            <View style={s.chips}>
              <Chip label={tr('onboarding.showAll')} selected={genderPref === 'all'} onPress={() => setGenderPref('all')} />
              <Chip label={tr('onboarding.showMen')} selected={genderPref === 'men'} onPress={() => setGenderPref('men')} />
              <Chip label={tr('onboarding.showWomen')} selected={genderPref === 'women'} onPress={() => setGenderPref('women')} />
            </View>
          </View>

          <View style={s.group}>
            <View style={s.rangeHeader}>
              <Text style={s.question}>{tr('onboarding.ageRange')}</Text>
              <Text style={s.rangeValue}>
                {tr('onboarding.ageRangeValue', {
                  min: ageRange[0],
                  max: ageRange[1] >= AGE_SLIDER_MAX ? `${AGE_SLIDER_MAX}+` : ageRange[1],
                })}
              </Text>
            </View>
            <RangeSlider min={18} max={AGE_SLIDER_MAX} value={ageRange} onChange={setAgeRange} accessibilityLabel={tr('onboarding.ageRange')} />
          </View>
        </Page>

        {/* 6 — Location */}
        <Page width={SCREEN_WIDTH}>
          <View style={s.radar}>
            <RadarRing pulse={pulse1} />
            <RadarRing pulse={pulse2} />
            <RadarRing pulse={pulse3} />
            <View style={[s.radarCoreShadow, glossShadow]}>
              <View style={s.radarCore}>
                <GlossFill />
                <Ionicons name="navigate" size={30} color="#FFFFFF" />
              </View>
            </View>
          </View>
          <Header title={tr('onboarding.locationTitle')} subtitle={tr('onboarding.locationSubtitle')} />
          <View style={s.rules}>
            <RuleRow icon="lock-closed-outline" title={tr('onboarding.locPrivacyTitle')} body={tr('onboarding.locPrivacyBody')} />
            <RuleRow icon="notifications-outline" title={tr('onboarding.locNotifTitle')} body={tr('onboarding.locNotifBody')} last />
          </View>
        </Page>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button label={ctaLabel} onPress={handleNext} loading={submitting} disabled={ctaDisabled} />
        {currentStep === STEP_LOCATION && (
          <Button label={tr('onboarding.later')} variant="ghost" size="md" onPress={finishOnboarding} disabled={submitting} />
        )}
      </View>
    </View>
  );
}

function Page({ width, children }: { width: number; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <View style={{ width }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {children}
      </ScrollView>
    </View>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const s = useStyles();
  return (
    <View style={s.header}>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={s.subtitle}>{subtitle}</Text>
    </View>
  );
}

function LanguageOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const s = useStyles();
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [s.langOption, selected && s.langOptionOn, pressed && { opacity: 0.85 }]}
    >
      <Text style={s.langLabel}>{label}</Text>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={26} color={selected ? t.primary : t.textMuted} />
    </Pressable>
  );
}

/** Type a sport that isn't in the list; Enter or "Add" confirms. */
function AddSportInput({ onAdd }: { onAdd: (name: string) => boolean }) {
  const s = useStyles();
  const tr = useT();
  const [text, setText] = useState('');
  const submit = () => {
    if (onAdd(text)) setText('');
  };
  return (
    <View style={s.addRow}>
      <View style={{ flex: 1 }}>
        <TextField
          label={tr('onboarding.otherSportLabel')}
          placeholder={tr('onboarding.otherSportPlaceholder')}
          value={text}
          onChangeText={setText}
          maxLength={30}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <Button label={tr('onboarding.addSport')} size="md" onPress={submit} disabled={text.trim().length < 2} />
    </View>
  );
}

function RuleRow({ icon, title, body, last }: { icon: IconName; title: string; body: string; last?: boolean }) {
  const s = useStyles();
  const t = useTheme();
  return (
    <View style={[s.ruleRow, !last && s.ruleDivider]}>
      <Ionicons name={icon} size={24} color={t.text} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.ruleTitle}>{title}</Text>
        <Text style={s.ruleBody}>{body}</Text>
      </View>
    </View>
  );
}

function RadarRing({ pulse }: { pulse: SharedValue<number> }) {
  const s = useStyles();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.4, 1], [0.55, 0.22, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.6, 2.2]) }],
  }));
  return <Animated.View style={[s.radarRing, animatedStyle]} />;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    page: { paddingHorizontal: 24, paddingBottom: 32 },
    header: { marginTop: 12, marginBottom: 24, gap: 10 },
    title: { ...type.hero, color: t.text },
    subtitle: { ...type.body, color: t.textSecondary },

    langList: { gap: 12 },
    langOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 64,
      paddingHorizontal: 20,
      borderRadius: 18,
      backgroundColor: t.surface,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    langOptionOn: { borderColor: t.primary },
    langLabel: { ...type.subheading, fontSize: 18, color: t.text },

    rules: { marginBottom: 8 },
    ruleRow: { flexDirection: 'row', gap: 16, paddingVertical: 18 },
    ruleDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
    ruleTitle: { ...type.subheading, color: t.text },
    ruleBody: { ...type.callout, color: t.textSecondary },

    agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: t.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    checkboxOn: { borderWidth: 0 },
    agreeText: { ...type.callout, color: t.text, flex: 1 },
    strong: { fontFamily: 'Lato_900Black' },

    group: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
      paddingTop: 20,
      paddingBottom: 20,
    },
    groupTitle: { ...type.heading, color: t.text, marginBottom: 14 },
    questionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    question: { ...type.subheading, color: t.text, flexShrink: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 16 },
    hint: { ...type.caption, color: t.textSecondary, marginBottom: 12 },
    rangeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    rangeValue: { ...type.subheading, color: t.text, fontVariant: ['tabular-nums'] },

    radar: { height: 220, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    radarRing: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 2,
      borderColor: t.primary,
      backgroundColor: t.primarySoft,
    },
    radarCore: {
      width: 76,
      height: 76,
      borderRadius: 38,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },

    radarCoreShadow: { width: 76, height: 76, borderRadius: 38 },
    footer: { paddingHorizontal: 24, paddingTop: 12, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, backgroundColor: t.bg },
  }),
);
