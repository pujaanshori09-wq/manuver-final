import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandStage, Button, GlassButton, LanguageSwitcher, withAuthShell } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fonts, glass, type } from '@/lib/theme';

/**
 * Entry screen on black glass. The logo eases in; the actions follow it. Orange is kept for
 * the one primary action.
 */
function WelcomeScreen() {
  const router = useRouter();
  const tr = useT();
  const [actionsTop, setActionsTop] = useState<number>();

  return (
    <View style={styles.container}>
      <BrandStage bottom={actionsTop}>
        <Animated.Text entering={FadeIn.duration(600).delay(500)} style={styles.tagline} accessibilityRole="header">
          {tr('welcome.tagline')}
        </Animated.Text>
      </BrandStage>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <LanguageSwitcher onDark />
        </View>

        <View style={{ flex: 1 }} />

        <Animated.View
          entering={FadeInDown.duration(600).delay(350)}
          style={styles.bottom}
          onLayout={(e) => setActionsTop(e.nativeEvent.layout.y)}
        >
          <Text style={styles.legal}>
            {tr('welcome.legalPrefix')}
            <Text style={styles.legalStrong}>{tr('welcome.terms')}</Text>
            {tr('welcome.legalMiddle')}
            <Text style={styles.legalStrong}>{tr('welcome.privacy')}</Text>
            {tr('welcome.legalSuffix')}
          </Text>

          <Button label={tr('welcome.createAccount')} onPress={() => router.push('/register')} />
          <GlassButton label={tr('welcome.signIn')} onPress={() => router.push('/login')} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export default withAuthShell(WelcomeScreen);

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 8, zIndex: 2 },
  bottom: { paddingBottom: 12, gap: 10 },
  tagline: { ...type.body, color: glass.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  legal: {
    ...type.caption,
    color: glass.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 8,
  },
  legalStrong: { fontFamily: fonts.bodyBlack, color: '#FFFFFF' },
});
