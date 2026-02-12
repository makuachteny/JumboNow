import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  Share2,
  MessageCircle,
  Calendar,
  MapPin,
  X,
  UserPlus,
  Check,
} from 'lucide-react-native';
import { groupChatService } from '../services/groupChat.service';
import { friendGroupsService } from '../services/friendGroups.service';
import { friendsService } from '../services/friends.service';
import { eventsService } from '../services/events.service';
import { supabase } from '../config/supabase';
import { Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes < 10 ? `0${minutes}` : minutes;
  return `${h}:${m} ${ampm}`;
}

export default function GroupChatScreen({ navigation, route }) {
  const { groupConversationId, groupId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [groupName, setGroupName] = useState(route.params?.groupName || 'Group');
  const [groupIcon, setGroupIcon] = useState(route.params?.groupIcon || '\uD83D\uDC65');
  const [memberCount, setMemberCount] = useState(route.params?.memberCount || 0);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [existingMembers, setExistingMembers] = useState(new Set());
  const [addingMember, setAddingMember] = useState(null);

  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setChatError(null);
      const msgs = await groupChatService.getMessages(groupConversationId);
      setMessages(msgs);
    } catch (err) {
      setChatError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [groupConversationId]);

  useEffect(() => {
    fetchMessages();

    const sub = groupChatService.subscribeToGroupMessages(groupConversationId, async () => {
      const freshMessages = await groupChatService.getMessages(groupConversationId);
      setMessages(freshMessages);
    });
    subscriptionRef.current = sub;

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [fetchMessages, groupConversationId]);

  const handleSend = useCallback(async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const sentMsg = await groupChatService.sendMessage(groupConversationId, text);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      setChatError(err.message || 'Failed to send message.');
      setMessageText(text);
    } finally {
      setSending(false);
    }
  }, [messageText, sending, groupConversationId]);

  const handleShareEvent = useCallback(async (event) => {
    setShowEventPicker(false);
    setSending(true);
    try {
      const metadata = {
        type: 'event_share',
        event_id: event.id,
        event_title: event.title,
        event_date: event.start_time,
        event_location: event.location || '',
        event_icon: event.icon || '\uD83C\uDF89',
      };
      const sentMsg = await groupChatService.sendMessage(groupConversationId, '', metadata);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      setChatError(err.message || 'Failed to share event.');
    } finally {
      setSending(false);
    }
  }, [groupConversationId]);

  const openEventPicker = useCallback(async () => {
    setShowEventPicker(true);
    setEventsLoading(true);
    try {
      const data = await eventsService.getEvents();
      setEvents((data || []).slice(0, 20));
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const openAddMember = useCallback(async () => {
    setShowAddMember(true);
    try {
      const [friends, members] = await Promise.all([
        friendsService.getFriends(),
        supabase.from('friend_group_members').select('user_id').eq('group_id', groupId),
      ]);
      const memberIds = new Set((members.data || []).map((m) => m.user_id));
      setExistingMembers(memberIds);
      setFriendsList(friends.filter((f) => !memberIds.has(f.id)));
    } catch {
      setFriendsList([]);
    }
  }, [groupId]);

  const handleAddMember = useCallback(async (friend) => {
    setAddingMember(friend.id);
    try {
      await friendGroupsService.addMember(groupId, friend.id);
      setExistingMembers((prev) => new Set([...prev, friend.id]));
      setFriendsList((prev) => prev.filter((f) => f.id !== friend.id));
      setMemberCount((prev) => prev + 1);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add member.');
    } finally {
      setAddingMember(null);
    }
  }, [groupId]);

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === currentUserId;
    const senderName = item.sender?.display_name || item.sender?.username || 'User';
    const senderInitial = senderName.slice(0, 1).toUpperCase();
    const senderColor = item.sender?.avatar_color || colors.accent;

    // Event share card
    if (item.metadata?.type === 'event_share') {
      const meta = item.metadata;
      const eventDate = meta.event_date
        ? new Date(meta.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      return (
        <View style={[styles.messageBubbleRow, isMine ? styles.messageBubbleRowRight : styles.messageBubbleRowLeft]}>
          {!isMine && (
            <View style={[styles.msgAvatar, { backgroundColor: senderColor }]}>
              <Text style={styles.msgAvatarText}>{senderInitial}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.eventShareCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('EventDetail', { eventId: meta.event_id })}
          >
            {!isMine && <Text style={styles.senderName}>{senderName}</Text>}
            <View style={styles.eventShareHeader}>
              <View style={styles.eventShareIconWrap}>
                <Text style={styles.eventShareIcon}>{meta.event_icon || '\uD83C\uDF89'}</Text>
              </View>
              <View style={styles.eventShareInfo}>
                <Text style={styles.eventShareTitle} numberOfLines={2}>{meta.event_title}</Text>
                {eventDate ? <Text style={styles.eventShareDate}>{eventDate}</Text> : null}
                {meta.event_location ? <Text style={styles.eventShareLocation} numberOfLines={1}>{meta.event_location}</Text> : null}
              </View>
            </View>
            <View style={styles.viewEventBtn}>
              <Text style={styles.viewEventBtnText}>View Event</Text>
            </View>
            <Text style={[styles.messageTime, isMine ? styles.messageTimeSent : styles.messageTimeReceived]}>
              {formatMessageTime(item.created_at)}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubbleRow, isMine ? styles.messageBubbleRowRight : styles.messageBubbleRowLeft]}>
        {!isMine && (
          <View style={[styles.msgAvatar, { backgroundColor: senderColor }]}>
            <Text style={styles.msgAvatarText}>{senderInitial}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isMine ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
          {!isMine && <Text style={styles.senderName}>{senderName}</Text>}
          <Text style={[styles.messageText, isMine ? styles.messageTextSent : styles.messageTextReceived]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isMine ? styles.messageTimeSent : styles.messageTimeReceived]}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={colors.backgroundGradient} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <ArrowLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <View style={[styles.groupIconWrap, { backgroundColor: (route.params?.groupColor || '#6AADE4') + '20' }]}>
          <Text style={styles.groupIconText}>{groupIcon}</Text>
        </View>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName} numberOfLines={1}>{groupName}</Text>
          <Text style={styles.chatHeaderStatus}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMember} accessibilityLabel="Add member to group" accessibilityRole="button">
          <UserPlus size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {chatError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{chatError}</Text>
          <TouchableOpacity onPress={() => setChatError(null)}>
            <Text style={styles.errorDismiss}>{'\u2715'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted={false}
            contentContainerStyle={[styles.messagesList, messages.length === 0 && styles.messagesListEmpty]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: false });
            }}
            onLayout={() => {
              if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: false });
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatIconWrap}>
                  <MessageCircle size={40} color={colors.accentMuted} />
                </View>
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatSubtext}>Start the conversation!</Text>
              </View>
            }
          />
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity style={styles.shareButton} onPress={openEventPicker} accessibilityLabel="Share an event" accessibilityRole="button">
            <Share2 size={18} color={colors.accent} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.accentMuted}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Send size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Event Picker Modal */}
      <Modal visible={showEventPicker} animationType="slide" transparent onRequestClose={() => setShowEventPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Share an Event</Text>
              <TouchableOpacity onPress={() => setShowEventPicker(false)} accessibilityLabel="Close event picker" accessibilityRole="button">
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {eventsLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ paddingVertical: 40 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {events.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Calendar size={40} color={colors.accentMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 12 }}>No upcoming events</Text>
                  </View>
                ) : (
                  events.map((event) => (
                    <TouchableOpacity
                      key={event.id}
                      style={styles.eventPickerItem}
                      onPress={() => handleShareEvent(event)}
                    >
                      <Text style={styles.eventPickerIcon}>{event.icon || '\uD83C\uDF89'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventPickerTitle} numberOfLines={1}>{event.title}</Text>
                        <Text style={styles.eventPickerMeta} numberOfLines={1}>
                          {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {event.location ? ` \u2022 ${event.location}` : ''}
                        </Text>
                      </View>
                      <Send size={16} color={colors.accent} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Members</Text>
              <TouchableOpacity onPress={() => setShowAddMember(false)} accessibilityLabel="Close add members" accessibilityRole="button">
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {friendsList.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No friends to add</Text>
                <Text style={styles.modalEmptySubtext}>All your friends are already in this group, or you haven't added friends yet.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {friendsList.map((friend) => {
                  const name = friend.display_name || friend.username || 'User';
                  const initials = name.slice(0, 2).toUpperCase();
                  const avatarBg = friend.avatar_color || '#6AADE4';
                  const isAdding = addingMember === friend.id;
                  return (
                    <View key={friend.id} style={styles.addMemberRow}>
                      <View style={[styles.addMemberAvatar, { backgroundColor: avatarBg }]}>
                        <Text style={styles.addMemberAvatarText}>{initials}</Text>
                      </View>
                      <View style={styles.addMemberInfo}>
                        <Text style={styles.addMemberName} numberOfLines={1}>{name}</Text>
                        {friend.username ? <Text style={styles.addMemberUsername}>@{friend.username}</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={styles.addMemberAction}
                        onPress={() => handleAddMember(friend)}
                        disabled={isAdding}
                        accessibilityLabel={`Add ${name} to group`}
                        accessibilityRole="button"
                      >
                        {isAdding ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <UserPlus size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  groupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconText: { fontSize: 20 },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  chatHeaderStatus: { color: colors.textTertiary, fontSize: 12, fontWeight: '500' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '600', flex: 1 },
  errorDismiss: { color: colors.error, fontSize: 16, marginLeft: 10 },

  chatBody: { flex: 1 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },
  messagesListEmpty: { flexGrow: 1, justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  messageBubbleRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  messageBubbleRowLeft: { justifyContent: 'flex-start' },
  messageBubbleRowRight: { justifyContent: 'flex-end' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  msgAvatarText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  senderName: { color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageBubbleSent: { backgroundColor: colors.buttonPrimary, borderBottomRightRadius: 4 },
  messageBubbleReceived: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageTextSent: { color: '#FFFFFF' },
  messageTextReceived: { color: colors.text },
  messageTime: { fontSize: 10, fontWeight: '500', marginTop: 4 },
  messageTimeSent: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  messageTimeReceived: { color: colors.accentMuted },

  // Event share card
  eventShareCard: {
    width: 260,
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  eventShareHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  eventShareIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  eventShareIcon: { fontSize: 24 },
  eventShareInfo: { flex: 1 },
  eventShareTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  eventShareDate: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 3 },
  eventShareLocation: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  viewEventBtn: {
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    marginBottom: 4,
  },
  viewEventBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  // Empty chat
  emptyChat: { alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyChatIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyChatTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptyChatSubtext: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: 'transparent',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.buttonPrimary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },

  // Event picker modal
  pickerOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  pickerContent: {
    backgroundColor: colors.modalBg || colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  eventPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  eventPickerIcon: { fontSize: 28 },
  eventPickerTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  eventPickerMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

  // Add member
  addMemberBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  addMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addMemberAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  addMemberInfo: { flex: 1 },
  addMemberName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  addMemberUsername: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  addMemberAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmpty: { alignItems: 'center', paddingVertical: 30 },
  modalEmptyText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  modalEmptySubtext: { color: colors.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
});
