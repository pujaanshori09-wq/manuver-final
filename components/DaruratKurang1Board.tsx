import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../app/_layout';

import { useTheme, makeStyles, type Theme, fonts, space } from '@/lib/theme';
import { useT } from '@/lib/i18n';
interface EmergencySlot {
  id: string;
  creator_id: string;
  sport: string;
  venue_name: string;
  play_time: string;
  slots_needed: number;
  fee_per_person: number;
  note?: string;
  creator?: { nama: string; foto_url: string };
}

interface Props {
  onOpenCreate: () => void;
}

export default function DaruratKurang1Board({ onOpenCreate }: Props) {
  const tr = useT();
  const th = useTheme();
  const styles = useStylesTheme();
  const { session } = useAuth();
  const [slots, setSlots] = useState<EmergencySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchActiveSlots = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('emergency_slots')
        .select('id, creator_id, sport, venue_name, play_time, slots_needed, fee_per_person, note, creator:creator_id (nama, foto_url)')
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('play_time', { ascending: true })
        .limit(10);
      if (!error && data) setSlots(data as any);
    } catch (err) {
      console.log('Error fetching emergency slots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveSlots();
    const channel = supabase
      .channel('emergency-slots-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_slots' }, () => fetchActiveSlots())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchActiveSlots]);

  const handleClaim = async (slot: EmergencySlot) => {
    if (!session) { Alert.alert(tr('sheets.heads'), tr('sheets.authBody')); return; }
    if (slot.creator_id === session.user.id) { Alert.alert(tr('sheets.info'), tr('sheets.ownSlot')); return; }
    Alert.alert(tr('sheets.joinSos'), tr('sheets.joinSosBody', { sport: slot.sport, venue: slot.venue_name, fee: slot.fee_per_person > 0 ? 'Rp ' + slot.fee_per_person.toLocaleString('id-ID') : tr('sheets.free') }),
      [{ text: tr('sheets.cancel'), style: 'cancel' }, {
        text: tr('sheets.letsGo'), onPress: async () => {
          setClaimingId(slot.id);
          try {
            const { data, error } = await supabase.rpc('claim_emergency_slot', { p_slot_id: slot.id });
            if (error) throw error;
            if (data?.success) {
              // The WhatsApp number is only revealed to whoever successfully claims the spot.
              const wa: string | undefined = data.contact_wa;
              Alert.alert(tr('sheets.joined'), tr('sheets.joinedBody', { venue: slot.venue_name }), [
                ...(wa ? [{ text: tr('sheets.chatWa'), onPress: () => { const p = wa.replace(/[^0-9]/g, ''); Linking.openURL('https://wa.me/' + (p.startsWith('0') ? '62' + p.slice(1) : p)); } }] : []),
                { text: tr('sheets.ok') },
              ]);
              fetchActiveSlots();
            } else {
              const reason = data?.message;
              Alert.alert(
                tr('sheets.failed'),
                reason === 'already_claimed' ? tr('sheets.alreadyClaimed')
                  : reason === 'own_slot' ? tr('sheets.ownSlot')
                  : tr('sheets.claimFailed'),
              );
              fetchActiveSlots();
            }
          } catch (err: any) { Alert.alert(tr('sheets.error'), err.message); } finally { setClaimingId(null); }
        }
      }]);
  };

  const formatTime = (t: string) => { const d = new Date(t); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} WIB`; };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.badgeSOS}><Ionicons name="flame" size={14} color="#FFF" /><Text style={styles.badgeSOSText}>{tr('sheets.sosBoard')}</Text></View>
        <TouchableOpacity accessibilityRole="button" style={styles.postButton} onPress={onOpenCreate} activeOpacity={0.8}><Ionicons name="add" size={16} color={th.primary} /><Text style={styles.postButtonText}>{tr('sheets.postSos')}</Text></TouchableOpacity>
      </View>
      {loading ? (<View style={styles.loadingBox}><ActivityIndicator color={th.primary} size="small" /></View>)
        : slots.length === 0 ? (<View style={styles.emptyCard}><Ionicons name="checkmark-circle-outline" size={24} color={th.textMuted} /><Text style={styles.emptyTitle}>{tr('sheets.noSos')}</Text><Text style={styles.emptySub}>{tr('sheets.noSosBody')}</Text></View>)
        : (<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {slots.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.sportBadge}><Text style={styles.sportText}>{item.sport}</Text></View>
                <View style={styles.slotCountBadge}><Text style={styles.slotCountText}>{tr('sheets.needs', { n: item.slots_needed })}</Text></View>
              </View>
              <Text style={styles.venueName} numberOfLines={1}>{item.venue_name}</Text>
              <View style={styles.metaRow}><Ionicons name="time-outline" size={13} color={th.primary} /><Text style={styles.metaTime}>{formatTime(item.play_time)}</Text><Text style={styles.dot}>�</Text><Text style={styles.metaFee}>{item.fee_per_person > 0 ? 'Rp ' + item.fee_per_person.toLocaleString('id-ID') : 'Gratis'}</Text></View>
              {item.note ? <Text style={styles.noteText} numberOfLines={1}>"{item.note}"</Text> : null}
              <TouchableOpacity accessibilityRole="button" style={styles.claimButton} onPress={() => handleClaim(item)} disabled={claimingId === item.id} activeOpacity={0.85}>
                {claimingId === item.id ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.claimButtonText}>{tr('sheets.takeSpot')}</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>)}
    </View>
  );
}

const useStylesTheme = makeStyles((th: Theme) => StyleSheet.create({
  container: { marginVertical: space.xs },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, marginBottom: space.xs },
  badgeSOS: { flexDirection: 'row', alignItems: 'center', backgroundColor: th.danger, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, gap: 4 },
  badgeSOSText: { fontFamily: fonts.display, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.5 },
  postButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  postButtonText: { fontFamily: fonts.displaySemi, fontSize: 13, color: th.primary },
  loadingBox: { height: 120, justifyContent: 'center', alignItems: 'center' },
  emptyCard: { marginHorizontal: space.md, backgroundColor: th.surface, padding: space.sm, borderRadius: 12, borderWidth: 1, borderColor: th.border, alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: th.text },
  emptySub: { fontFamily: fonts.body, fontSize: 11, color: th.textMuted, textAlign: 'center' },
  scrollList: { paddingHorizontal: space.md, gap: 12 },
  card: { width: 220, backgroundColor: th.surface, borderRadius: 12, padding: space.sm, borderWidth: 1, borderColor: th.dangerSoft },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sportBadge: { backgroundColor: th.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sportText: { fontFamily: fonts.displaySemi, fontSize: 11, color: th.primary },
  slotCountBadge: { backgroundColor: th.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  slotCountText: { fontFamily: fonts.display, fontSize: 10, color: '#FFFFFF' },
  venueName: { fontFamily: fonts.display, fontSize: 14, color: th.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  metaTime: { fontFamily: fonts.bodyBold, fontSize: 12, color: th.text },
  dot: { color: th.textMuted },
  metaFee: { fontFamily: fonts.bodyBold, fontSize: 12, color: th.success },
  noteText: { fontFamily: fonts.body, fontSize: 11, color: th.textSecondary, fontStyle: 'italic', marginBottom: 10 },
  claimButton: { backgroundColor: th.primary, paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  claimButtonText: { fontFamily: fonts.displaySemi, fontSize: 12, color: '#FFFFFF' },
}));
