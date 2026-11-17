import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/lib/theme';
import { GlossFill } from './Gloss';

/** Tier badge. Pro = glossy orange; Elite = black with an orange edge (reads in both themes). */
export function ProBadge({ tier, large }: { tier: 'pro' | 'elite'; large?: boolean }) {
  const label = tier === 'pro' ? 'PRO' : 'ELITE';
  return (
    <View style={[styles.badge, large && styles.large, tier === 'elite' && styles.elite]}>
      {tier === 'pro' && <GlossFill />}
      <Text style={[styles.text, large && styles.textLarge, tier === 'elite' && styles.eliteText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  large: { paddingHorizontal: 14, paddingVertical: 5 },
  elite: { backgroundColor: '#0A0A0A', borderWidth: 1.5, borderColor: '#FF5A1F' },
  text: { fontFamily: fonts.display, fontSize: 12, lineHeight: 15, letterSpacing: 1, color: '#FFFFFF' },
  textLarge: { fontSize: 14, lineHeight: 18 },
  eliteText: { color: '#FF7A3D' },
});
