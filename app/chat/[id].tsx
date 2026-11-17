import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AjakMainSheet from '../../components/AjakMainSheet';
import SparingInviteCard from '../../components/SparingInviteCard';
import { useChat } from '../../hooks/useChat';
import { Message } from '../../types/database';
import { useTheme, makeStyles, type Theme, space, fonts } from '@/lib/theme';
import { useT } from '@/lib/i18n';
// Removed inline Message interface

// Conversation starters (generic tips, not claims about the partner).
const CHEMISTRY_MESSAGES = ['chatRoom.tip1', 'chatRoom.tip2', 'chatRoom.tip3', 'chatRoom.tip4'] as const;

const ChemistrySnippet = ({ partnerName }: { partnerName: string }) => {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  const [msg] = useState(() => CHEMISTRY_MESSAGES[Math.floor(Math.random() * CHEMISTRY_MESSAGES.length)]);
  
  return (
    <View style={styles.chemistryContainer}>
      <View style={styles.chemistryIconBox}>
        <Ionicons name="sparkles" size={16} color={t.primary} />
      </View>
      <Text style={styles.chemistryText}>
        {tr(msg, { name: partnerName || tr('chatRoom.them') })}
      </Text>
    </View>
  );
};

export default function ChatScreen() {
  const tr = useT();
  const t = useTheme();
  const styles = useStylesTheme();
  // `id` is the match id; `partnerId` is the other person's profile id.
  const { id, name, avatar, partnerId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [inputText, setInputText] = useState('');
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  
  const {
    messages,
    loading,
    error,
    refetch,
    currentUserId,
    sendMessage,
    sendSparingInvite,
    retryMessage,
    discardMessage,
    updateInviteStatus,
  } = useChat(id);

  const respondToInvite = async (messageId: string, status: 'accepted' | 'declined') => {
    const ok = await updateInviteStatus(messageId, status);
    if (!ok) Alert.alert(tr('chatRoom.inviteFailedTitle'), tr('chatRoom.inviteFailedBody'));
  };
  
  const flatListRef = useRef<FlatList>(null);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  // Navigate to full profile when tapping avatar or name
  const handleOpenProfile = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/user/[id]',
      params: { id: (partnerId as string) || (id as string), name: name as string, avatar: avatar as string },
    });
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUserId;

    if (item.type === 'sparing_invite') {
      return (
        <SparingInviteCard
          inviteId={item.id}
          sport={item.metadata?.sport || tr('chatRoom.sportFallback')}
          venueName={item.metadata?.venue_name || tr('chatRoom.venueFallback')}
          scheduledAt={item.metadata?.scheduled_at || new Date().toISOString()}
          status={item.metadata?.status || 'pending'}
          isReceiver={!isMe}
          onAccept={() => respondToInvite(item.id, 'accepted')}
          onDecline={() => respondToInvite(item.id, 'declined')}
          note={item.metadata?.note}
        />
      );
    }

    return (
      <View style={[styles.bubbleContainer, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.textMe : styles.textThem]}>
            {item.content}
          </Text>
        </View>
        {item.status === 'failed' ? (
          <View style={styles.failedRow}>
            <Pressable
              onPress={() => retryMessage(item.id)}
              accessibilityRole="button"
              accessibilityLabel={tr('chatRoom.retry')}
              hitSlop={10}
              style={styles.failedRetry}
            >
              <Ionicons name="alert-circle" size={15} color={t.danger} />
              <Text style={styles.failedText}>{tr('chatRoom.notSent')} · {tr('chatRoom.retry')}</Text>
            </Pressable>
            <Pressable onPress={() => discardMessage(item.id)} accessibilityRole="button" accessibilityLabel={tr('chatRoom.discard')} hitSlop={10}>
              <Ionicons name="close" size={16} color={t.textSecondary} />
            </Pressable>
          </View>
        ) : item.status === 'sending' ? (
          <Text style={styles.sendingText}>{tr('chatRoom.sending')}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={tr('common.back')}
        >
          <Ionicons name="chevron-back" size={26} color={t.text} />
        </TouchableOpacity>
        
        {/* Clickable Header Profile -> Opens Sarah's Full Profile */}
        <TouchableOpacity accessibilityRole="button"
          style={styles.headerProfile}
          onPress={handleOpenProfile}
          activeOpacity={0.7}
          accessibilityLabel={tr('chatRoom.openProfile', { name: String(name ?? '') })}
        >
          <Image source={{ uri: avatar as string }} style={styles.headerAvatar} />
          <View>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>{name}</Text>
              <Ionicons name="chevron-forward" size={14} color={t.textSecondary} />
            </View>
            <Text style={styles.headerStatus}>{tr('chatRoom.viewProfile')}</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.optionsBtn}
          onPress={handleOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={tr('chatRoom.openProfile', { name: String(name ?? '') })}
        >
          <Ionicons name="person-circle-outline" size={24} color={t.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={t.textMuted} />
          <Text style={styles.errorTitle}>{tr('chatRoom.loadFailed')}</Text>
          <Pressable onPress={() => refetch()} accessibilityRole="button" style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>{tr('chatRoom.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={<ChemistrySnippet partnerName={name as string} />}
        />
      )}



      {/* Input Bar */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder={tr('chatRoom.placeholder')}
            placeholderTextColor={t.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
        </View>

        {!inputText.trim() ? (
          <View style={styles.rightActionIcons}>
            <TouchableOpacity 
              style={styles.actionIconBtn} 
              activeOpacity={0.7}
              onPress={() => setIsSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={tr('chatRoom.inviteToPlay')}
            >
              <Ionicons name="flash" size={26} color={t.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.sendButton} 
            onPress={() => handleSendMessage()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tr('chatRoom.send')}
          >
            <Ionicons name="send" size={18} color={'#FFFFFF'} />
          </TouchableOpacity>
        )}
      </View>

      <AjakMainSheet
        visible={isSheetVisible}
        onClose={() => setIsSheetVisible(false)}
        partnerName={name as string}
        onSend={async (inviteData) => {
          setIsSheetVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await sendSparingInvite(inviteData);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const useStylesTheme = makeStyles((t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: 10,
    zIndex: 10,
    backgroundColor: t.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: t.text,
  },
  headerStatus: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: t.textSecondary,
  },
  optionsBtn: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, alignSelf: 'flex-end' },
  failedRetry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  failedText: { fontSize: 13, color: t.danger, fontFamily: 'Lato_700Bold' },
  sendingText: { fontFamily: fonts.body, fontSize: 12, color: t.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  errorTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: t.text, marginTop: 12 },
  errorBtn: { marginTop: 12, paddingHorizontal: 20, height: 44, borderRadius: 999, backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center' },
  errorBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: t.onInk },
  listContent: { padding: space.md, paddingBottom: 80 },
  chemistryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    padding: space.sm,
    borderRadius: 18,
    marginBottom: space.md,
  },
  chemistryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: space.xs,
  },
  chemistryText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: t.textSecondary,
    lineHeight: 19,
  },
  bubbleContainer: { marginBottom: 12, width: '100%' },
  bubbleRight: { alignItems: 'flex-end' },
  bubbleLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMe: {
    backgroundColor: t.primary,
    borderBottomRightRadius: 6,
  },
  bubbleThem: {
    backgroundColor: t.surface,
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 16, lineHeight: 22, fontFamily: 'Lato_400Regular' },
  textMe: { color: '#FFFFFF' },
  textThem: { color: t.text },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 12,
    backgroundColor: t.bg,
  },
  actionIconBtn: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.hairline,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    color: t.text,
    maxHeight: 100,
    fontSize: 16,
    fontFamily: 'Lato_400Regular',
  },
  gifBtn: {
    paddingRight: 12,
    paddingLeft: 4,
    justifyContent: 'center',
  },
  gifBadge: {
    borderWidth: 1.5,
    borderColor: t.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  gifText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: t.textSecondary,
  },
  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
