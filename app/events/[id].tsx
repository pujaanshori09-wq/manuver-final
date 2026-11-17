import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme, makeStyles, type Theme, fonts, space, radius } from '@/lib/theme';
import { useT } from '@/lib/i18n';
export default function EventDetailScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);

  const fetchEventDetails = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // Ambil data event
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      setEvent(data);

      // Cek apakah user sudah mendaftar
      if (userId) {
        const { data: regData } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', id)
          .eq('user_id', userId)
          .eq('status', 'registered')
          .single();
          
        if (regData) setHasRegistered(true);
      }
    } catch (e: any) {
      Alert.alert(tr('event.error'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setRegistering(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error("Anda harus login untuk mendaftar.");

      const { error } = await supabase.from('event_registrations').insert([
        {
          event_id: id,
          user_id: userData.user.id,
          status: 'registered'
        }
      ]);

      if (error) {
        if (error.code === '23505') { // unique violation
          throw new Error("Anda sudah terdaftar di event ini.");
        }
        throw error;
      }

      // Update angka partisipan di UI optimistically
      setHasRegistered(true);
      Alert.alert(tr('event.registeredTitle'), tr('event.registeredBody'));
      
    } catch (e: any) {
      Alert.alert(tr('event.registerFailed'), e.message);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: t.text }}>{tr('event.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: event.image_url }} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(9,10,13,0.7)', 'transparent', t.bg]}
            locations={[0, 0.4, 1]}
            style={styles.heroGradient}
          />
          <TouchableOpacity 
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={tr('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={'#FFFFFF'} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{event.category} • {event.type}</Text>
          </View>
          
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.organizer}>{tr('event.by')} {event.organizer}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}><Ionicons name="calendar" size={20} color={t.primary} /></View>
              <View>
                <Text style={styles.infoLabel}>{tr('event.dateTime')}</Text>
                <Text style={styles.infoValue}>{event.date}</Text>
              </View>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}><Ionicons name="location" size={20} color={t.primary} /></View>
              <View>
                <Text style={styles.infoLabel}>{tr('event.location')}</Text>
                <Text style={styles.infoValue}>{event.location}, {event.city}</Text>
              </View>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}><Ionicons name="ticket" size={20} color={t.primary} /></View>
              <View>
                <Text style={styles.infoLabel}>{tr('event.price')}</Text>
                <Text style={styles.infoValue}>{event.price}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{tr('event.verification')}</Text>
          <View style={styles.statusBox}>
            <Ionicons 
              name={event.status === 'approved' ? 'checkmark-circle' : 'time'} 
              size={24} 
              color={event.status === 'approved' ? t.success : t.primary} 
            />
            <Text style={styles.statusText}>
              {event.status === 'approved' ? tr('event.verified') : tr('event.inReview')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity accessibilityRole="button" 
          style={[
            styles.registerBtn, 
            hasRegistered && styles.registeredBtn,
            (registering || (event.status !== 'approved' && !hasRegistered)) && { opacity: 0.5 }
          ]} 
          onPress={hasRegistered ? undefined : handleRegister}
          disabled={hasRegistered || registering || event.status !== 'approved'}
        >
          <Text style={styles.registerBtnText}>
            {registering ? tr('event.registering') : hasRegistered ? tr('event.registered') : event.status === 'approved' ? tr('event.register') : tr('event.notVerified')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  heroContainer: { width: '100%', height: 350, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFill },
  backBtn: { position: 'absolute', left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.md, marginTop: -30 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: t.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 12 },
  categoryText: { color: t.primaryText, fontSize: 13, fontFamily: fonts.bodyBold },
  title: { fontSize: 28, fontFamily: fonts.display, color: t.text, marginBottom: 8, letterSpacing: -0.5 },
  organizer: { fontFamily: fonts.body, fontSize: 14, color: t.textSecondary, marginBottom: 24 },
  infoCard: { backgroundColor: t.surface, borderRadius: 24, padding: 18, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontFamily: fonts.body, fontSize: 12, color: t.textSecondary, marginBottom: 2 },
  infoValue: { fontSize: 16, color: t.text, fontFamily: fonts.bodyBold },
  infoDivider: { height: 1, backgroundColor: t.border, marginVertical: 12 },
  sectionTitle: { fontSize: 20, fontFamily: fonts.displaySemi, color: t.text, marginBottom: 12 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, padding: 16, borderRadius: 20 },
  statusText: { flex: 1, fontSize: 15, color: t.text, lineHeight: 21, fontFamily: fonts.body },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: t.bg, paddingHorizontal: space.md, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  registerBtn: { backgroundColor: t.primary, minHeight: 58, justifyContent: 'center', borderRadius: radius.pill, alignItems: 'center' },
  registeredBtn: { backgroundColor: t.success },
  registerBtnText: { color: '#FFFFFF', fontSize: 18, fontFamily: fonts.displaySemi },
}));
